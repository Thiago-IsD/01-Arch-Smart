"""
Validacao local do JWT do Supabase, que assina em ES256.

O projeto de staging assina com **ES256** (cabecalho do token:
`{"alg":"ES256","kid":"..."}`), e a API so sabia validar **HS256** com o
segredo compartilhado. A validacao local falhava sempre e o codigo caia no
caminho remoto — uma chamada HTTP a `/auth/v1/user` em toda requisicao
autenticada, medida em **0,240 s** contra a API implantada em 13/09/2026
(`docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md`).

O que estes testes fixam, e por que cada um:

- a chave publica vem do JWKS do projeto e fica em cache: se cada requisicao
  buscasse o JWKS, a ida remota so teria mudado de endereco;
- `kid` desconhecido busca o JWKS **uma vez** — e uma chave rotacionada
  precisa ser aprendida sem reiniciar o processo — mas **nao martela** o
  endpoint a cada token invalido, que seria um amplificador de trafego
  acionavel por qualquer um;
- assinatura de outra chave, token expirado e `alg: none` sao **recusados**.
  Estes tres sao a razao de o resto existir: validar local sem verificar
  assinatura seria aceitar qualquer token que alguem digitasse.
"""
import asyncio
import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from jose import jwk, jwt

from app.core import security
from app.core.jwks import CacheDeJwks, ChaveDesconhecida


def _par_de_chaves(kid: str) -> tuple[str, dict]:
    """Uma chave EC P-256 nova: a privada em PEM, a publica como JWK."""
    privada = ec.generate_private_key(ec.SECP256R1())
    pem = privada.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    publica = jwk.construct(pem, "ES256").public_key().to_dict()
    publica = {
        chave: (valor.decode() if isinstance(valor, bytes) else valor)
        for chave, valor in publica.items()
    }
    publica["kid"] = kid
    return pem, publica


def _token(pem: str, kid: str, **claims) -> str:
    corpo = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "email": "quem@teste.local",
        "exp": int(time.time()) + 3600,
        **claims,
    }
    return jwt.encode(corpo, pem, algorithm="ES256", headers={"kid": kid})


class _JwksFalso:
    """Serve o que lhe mandarem servir, e conta quantas vezes foi chamado."""

    def __init__(self, chaves: list[dict]):
        self.chaves = chaves
        self.buscas = 0

    async def __call__(self) -> dict:
        self.buscas += 1
        return {"keys": self.chaves}


def test_a_chave_vem_do_jwks_e_a_segunda_chamada_reaproveita_o_cache():
    _, publica = _par_de_chaves("kid-1")
    buscar = _JwksFalso([publica])
    cache = CacheDeJwks(buscar=buscar)

    primeira = asyncio.run(cache.chave("kid-1"))
    segunda = asyncio.run(cache.chave("kid-1"))

    assert primeira["kid"] == "kid-1"
    assert segunda == primeira
    assert buscar.buscas == 1, (
        f"{buscar.buscas} buscas ao JWKS para duas resolucoes: sem cache, a ida "
        "remota so mudou de endereco"
    )


def test_kid_desconhecido_busca_uma_vez_e_nao_martela_o_endpoint():
    _, publica = _par_de_chaves("kid-1")
    buscar = _JwksFalso([publica])
    cache = CacheDeJwks(buscar=buscar)

    for _ in range(5):
        with pytest.raises(ChaveDesconhecida):
            asyncio.run(cache.chave("kid-que-nao-existe"))

    assert buscar.buscas == 1, (
        f"{buscar.buscas} buscas para 5 tokens com `kid` desconhecido: qualquer "
        "um poderia usar isso para nos fazer martelar o Supabase"
    )


def test_chave_rotacionada_e_aprendida_depois_do_intervalo():
    _, antiga = _par_de_chaves("kid-antigo")
    _, nova = _par_de_chaves("kid-novo")
    buscar = _JwksFalso([antiga])
    agora = [1000.0]
    cache = CacheDeJwks(buscar=buscar, intervalo_minimo=60, relogio=lambda: agora[0])

    with pytest.raises(ChaveDesconhecida):
        asyncio.run(cache.chave("kid-novo"))

    buscar.chaves = [antiga, nova]
    agora[0] += 61

    achada = asyncio.run(cache.chave("kid-novo"))
    assert achada["kid"] == "kid-novo"
    assert buscar.buscas == 2


def _com_jwks(monkeypatch, chaves: list[dict]) -> _JwksFalso:
    buscar = _JwksFalso(chaves)
    monkeypatch.setattr(security, "_jwks", CacheDeJwks(buscar=buscar))
    return buscar


def test_aceita_es256_assinado_pela_chave_do_jwks(monkeypatch):
    pem, publica = _par_de_chaves("kid-1")
    _com_jwks(monkeypatch, [publica])

    supabase_id, email = asyncio.run(security.claims_do_token(_token(pem, "kid-1")))

    assert supabase_id == "11111111-1111-1111-1111-111111111111"
    assert email == "quem@teste.local"


def test_recusa_es256_assinado_por_outra_chave(monkeypatch):
    _, publica_do_projeto = _par_de_chaves("kid-1")
    pem_do_impostor, _ = _par_de_chaves("kid-1")
    _com_jwks(monkeypatch, [publica_do_projeto])

    with pytest.raises(Exception):
        asyncio.run(security.claims_do_token(_token(pem_do_impostor, "kid-1")))


def test_recusa_token_expirado(monkeypatch):
    pem, publica = _par_de_chaves("kid-1")
    _com_jwks(monkeypatch, [publica])

    with pytest.raises(Exception):
        asyncio.run(
            security.claims_do_token(
                _token(pem, "kid-1", exp=int(time.time()) - 10)
            )
        )


def test_recusa_alg_none(monkeypatch):
    """
    O `alg` vem do cliente. Um token que se declara `none` e traz assinatura
    vazia nao pode ser aceito por ninguem — e a jose se recusa a *criar* um
    desses, entao ele e montado a mao, que e exatamente como um atacante o
    montaria.

    O segredo HS256 e configurado de proposito: sem ele a recusa viria do
    `SUPABASE_JWT_SECRET ausente`, e o teste passaria sem provar nada sobre
    assinatura.
    """
    import base64
    import json

    _, publica = _par_de_chaves("kid-1")
    _com_jwks(monkeypatch, [publica])
    monkeypatch.setattr(
        security.settings,
        "SUPABASE_JWT_SECRET",
        base64.b64encode(b"um segredo de teste com bytes suficientes").decode(),
    )

    def _b64(dados: dict) -> str:
        bruto = json.dumps(dados).encode()
        return base64.urlsafe_b64encode(bruto).decode().rstrip("=")

    sem_assinatura = (
        f"{_b64({'alg': 'none', 'typ': 'JWT'})}."
        f"{_b64({'sub': 'x', 'email': 'y@z.local'})}."
    )

    with pytest.raises(Exception):
        asyncio.run(security.claims_do_token(sem_assinatura))


def test_continua_aceitando_hs256_com_o_segredo(monkeypatch):
    import base64

    segredo = base64.b64encode(b"um segredo de teste com bytes suficientes").decode()
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", segredo)
    token = jwt.encode(
        {"sub": "abc", "email": "hs@teste.local", "exp": int(time.time()) + 60},
        base64.b64decode(segredo),
        algorithm="HS256",
    )

    supabase_id, email = asyncio.run(security.claims_do_token(token))

    assert (supabase_id, email) == ("abc", "hs@teste.local")

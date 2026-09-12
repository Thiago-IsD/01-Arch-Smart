"""
Chave do rate limit do endpoint de telemetria.

O teste e direto na funcao de chave, nao enchendo o balde pelo endpoint: o
limite e estado de processo, e um teste que depende de ordem de execucao
para encher balde vira flake. O que importa provar e que dois portadores
diferentes produzem chaves diferentes, e que sem portador a chave cai no
comportamento de antes.
"""
import base64
import json

from starlette.requests import Request

from app.core.rate_limit import chave_por_conta


def _token(sub: str) -> str:
    corpo = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).decode().rstrip("=")
    return f"cabecalho.{corpo}.assinatura"


def _request(authorization: str | None) -> Request:
    cabecalhos = []
    if authorization:
        cabecalhos.append((b"authorization", authorization.encode()))
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/telemetry/events",
            "headers": cabecalhos,
            "client": ("10.0.0.1", 1234),
        }
    )


def test_portadores_diferentes_enchem_baldes_diferentes():
    a = chave_por_conta(_request(f"Bearer {_token('usuario-a')}"))
    b = chave_por_conta(_request(f"Bearer {_token('usuario-b')}"))
    assert a != b


def test_mesmo_portador_cai_no_mesmo_balde():
    token = _token("usuario-a")
    assert chave_por_conta(_request(f"Bearer {token}")) == chave_por_conta(
        _request(f"Bearer {token}")
    )


def test_sem_token_cai_no_ip():
    assert chave_por_conta(_request(None)) == "10.0.0.1"


def test_token_ilegivel_cai_no_ip():
    # Token que nao e um JWT nao pode derrubar requisicao: o limitador roda
    # antes de qualquer autenticacao, e quem responde 401 e o resolvedor de
    # identidade, nao este arquivo.
    assert chave_por_conta(_request("Bearer isto-nao-e-jwt")) == "10.0.0.1"


def test_sub_ausente_cai_no_ip():
    corpo = base64.urlsafe_b64encode(json.dumps({"aud": "x"}).encode()).decode().rstrip("=")
    assert chave_por_conta(_request(f"Bearer cab.{corpo}.ass")) == "10.0.0.1"

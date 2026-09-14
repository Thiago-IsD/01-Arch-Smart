"""
Identidade da requisicao, resolvida no servidor — uma vez, num lugar so.

Este e o UNICO modulo que sabe decodificar um token do Supabase. Nenhum
endpoint le `account_id` de corpo, query string ou header: o que vem do
cliente e ignorado sempre (Art. 1).

O que este modulo deliberadamente NAO faz, e por que:

- **Nao vincula usuario por e-mail.** Ate a Secao 4, quando o `sub` do token
  nao estava em nenhuma linha, o codigo procurava pelo e-mail e gravava o
  `supabase_id` do portador naquela linha — entregando a conta a quem tivesse
  um token com aquele e-mail no payload. O e-mail do token nao e identidade
  verificada deste lado.
- **Nao cria conta nem usuario.** Provisionamento tem rota propria
  (`POST /api/auth/signup`, `POST /api/auth/complete-register`). Criar de
  dentro da resolucao de identidade transformava todo endpoint autenticado
  num endpoint de cadastro.

Token que nao resolve para um usuario existente e 401, sem excecao.
"""
from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import Any, Mapping, Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from jose import jwt
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.jwks import CacheDeJwks
from app.db.session import get_db
from app.models.all_models import Plan, Subscription, User
from app.services.auth_service import auth_service
from app.services.entitlements import entitlements_de

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RequestContext:
    """
    Identidade da requisicao. Congelada de proposito: nenhum endpoint deve
    conseguir reescrever `account_id` no meio do caminho.
    """

    user_id: UUID
    account_id: UUID
    email: str
    entitlements: Mapping[str, Any]


class IdentidadeNaoResolvida(LookupError):
    """O token e valido, mas nao aponta para nenhum usuario deste banco."""


def _segredo_em_bytes(segredo: str) -> bytes:
    """
    O segredo do Supabase vem em base64; o HS256 assina sobre os bytes
    decodificados. Sem o padding, o b64decode estoura em segredos cujo
    comprimento nao e multiplo de 4.
    """
    limpo = segredo.strip()
    return base64.b64decode(limpo + "=" * (-len(limpo) % 4))


# Os dois jeitos de o projeto Supabase assinar, e nada alem deles. A lista e
# fechada de proposito: `alg` vem do token, ou seja, do cliente — aceitar o que
# ele mandar e como o `alg: none` entra.
ALGORITMOS_ASSIMETRICOS = ("ES256", "RS256")

_jwks = CacheDeJwks()


async def claims_do_token(token: str) -> tuple[Optional[str], Optional[str]]:
    """
    Devolve (supabase_id, email) do token, validando a assinatura localmente.
    Levanta se o token for invalido, expirado, ou assinado de um jeito que este
    projeto nao usa.

    Dois caminhos, escolhidos pelo `alg` do cabecalho:

    - **ES256/RS256** — chave publica do JWKS do projeto, buscada uma vez e
      guardada (`app/core/jwks.py`). E o que staging e producao emitem hoje.
    - **HS256** — segredo compartilhado. Continua aqui porque projeto Supabase
      mais antigo assina assim, e porque e o que os testes de contexto usam.

    O `alg` sai do cabecalho do token, que e dado do cliente — por isso ele so
    escolhe o CAMINHO, e o `algorithms=` passado ao `jwt.decode` e sempre um
    literal deste modulo. Passar o `alg` do token para o `decode` seria deixar
    o portador escolher como o proprio token e verificado.
    """
    cabecalho = jwt.get_unverified_header(token)
    algoritmo = cabecalho.get("alg")

    if algoritmo in ALGORITMOS_ASSIMETRICOS:
        chave = await _jwks.chave(cabecalho.get("kid"))
        payload = jwt.decode(
            token,
            chave,
            algorithms=list(ALGORITMOS_ASSIMETRICOS),
            options={"verify_aud": False},
        )
        return payload.get("sub"), payload.get("email")

    if not settings.SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET ausente")
    payload = jwt.decode(
        token,
        _segredo_em_bytes(settings.SUPABASE_JWT_SECRET),
        algorithms=["HS256"],
        options={"verify_aud": False},
    )
    return payload.get("sub"), payload.get("email")


def resolver_identidade_e_entitlements(
    db: Session, *, supabase_id: Optional[str], email: Optional[str]
) -> tuple[User, dict[str, Any]]:
    """
    Resolve o usuario E os entitlements da conta dele numa consulta so.

    So o `supabase_id` decide quem e o usuario. O `email` entra apenas no log
    de diagnostico — ele NAO e criterio de busca, e essa e a correcao de
    seguranca da Secao 4.

    Por que os dois juntos: este caminho roda em TODA requisicao autenticada, e
    cada consulta e uma ida a rede — **0,17 s** a partir do conteiner
    implantado, medido em 13/09/2026
    (`docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md`). Eram
    duas idas sequenciais; sao uma.

    Os dois `outerjoin` preservam o que o LEFT JOIN garante e o INNER nao:
    usuario sem assinatura continua resolvendo, com `status` nulo, e caindo no
    PADRAO por `entitlements_de`. O `order_by(Subscription.id)` e o mesmo de
    `entitlements_da_conta`, pela mesma razao: nao ha unique em
    `subscriptions.account_id`, entao sem ordem explicita o Postgres devolve
    uma linha arbitraria quando a conta tem mais de uma.
    """
    if not supabase_id:
        raise IdentidadeNaoResolvida("token sem `sub`")

    linha = (
        db.query(User, Subscription.status, Plan.limits)
        .outerjoin(Subscription, Subscription.account_id == User.account_id)
        .outerjoin(Plan, Plan.id == Subscription.plan_id)
        .filter(User.supabase_id == supabase_id)
        .order_by(Subscription.id)
        .first()
    )
    if linha is None:
        logger.warning(
            "Token valido sem usuario correspondente. supabase_id=%s email=%s",
            supabase_id,
            email,
        )
        raise IdentidadeNaoResolvida(
            f"nenhum usuario com supabase_id={supabase_id}"
        )

    usuario, status, limits = linha
    return usuario, entitlements_de(status, limits)


def resolve_identity_por_claims(
    db: Session, *, supabase_id: Optional[str], email: Optional[str]
) -> User:
    """
    O usuario, so ele. Fica como a face estreita da funcao acima — e nao como
    uma segunda consulta — para que os testes de seguranca que apontam para
    este nome continuem exercitando o caminho que a producao roda.
    """
    usuario, _ = resolver_identidade_e_entitlements(
        db, supabase_id=supabase_id, email=email
    )
    return usuario


async def resolve_identity(token: str, db: Session) -> tuple[User, dict[str, Any]]:
    """
    Valida o token e devolve o `User` mais os entitlements da conta. Tenta a
    validacao local (sem ida a rede); se o segredo nao estiver configurado ou a
    assinatura nao bater, cai no caminho remoto do `auth_service`.
    """
    try:
        supabase_id, email = await claims_do_token(token)
    except Exception as erro:
        logger.info("Validacao local do JWT falhou (%s); tentando remota.", erro)
        dados = await auth_service.get_user(token)
        supabase_id, email = dados["id"], dados.get("email")

    return await run_in_threadpool(
        resolver_identidade_e_entitlements, db, supabase_id=supabase_id, email=email
    )


async def get_context(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> RequestContext:
    """
    Dependencia de todo endpoint autenticado. Substitui `get_current_user`.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")
    token = authorization[len("Bearer ") :]

    try:
        usuario, entitlements = await resolve_identity(token, db)
    except IdentidadeNaoResolvida:
        # 401, nao 404: para quem chama, "esse token nao vale aqui". Dizer
        # "usuario nao encontrado" confirmaria a existencia de contas.
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")
    except HTTPException:
        raise
    except Exception as erro:
        logger.warning("Falha ao validar token: %s", erro, exc_info=True)
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")

    return RequestContext(
        user_id=usuario.id,
        account_id=usuario.account_id,
        email=usuario.email,
        entitlements=entitlements,
    )

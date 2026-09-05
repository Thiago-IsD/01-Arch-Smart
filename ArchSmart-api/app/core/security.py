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
from app.db.session import get_db
from app.models.all_models import User
from app.services.auth_service import auth_service
from app.services.entitlements import entitlements_da_conta

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


def claims_do_token(token: str) -> tuple[Optional[str], Optional[str]]:
    """
    Devolve (supabase_id, email) do token, validando a assinatura localmente.
    Levanta `jose.JWTError` se o token for invalido ou expirado.
    """
    if not settings.SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET ausente")
    payload = jwt.decode(
        token,
        _segredo_em_bytes(settings.SUPABASE_JWT_SECRET),
        algorithms=["HS256"],
        options={"verify_aud": False},
    )
    return payload.get("sub"), payload.get("email")


def resolve_identity_por_claims(
    db: Session, *, supabase_id: Optional[str], email: Optional[str]
) -> User:
    """
    Resolve o usuario a partir dos claims ja validados.

    So o `supabase_id` decide. O `email` entra apenas no log de diagnostico —
    ele NAO e criterio de busca, e essa e a correcao de seguranca da Secao 4.
    """
    if not supabase_id:
        raise IdentidadeNaoResolvida("token sem `sub`")

    usuario = db.query(User).filter(User.supabase_id == supabase_id).first()
    if usuario is None:
        logger.warning(
            "Token valido sem usuario correspondente. supabase_id=%s email=%s",
            supabase_id,
            email,
        )
        raise IdentidadeNaoResolvida(
            f"nenhum usuario com supabase_id={supabase_id}"
        )
    return usuario


async def resolve_identity(token: str, db: Session) -> User:
    """
    Valida o token e devolve o `User`. Tenta a validacao local (sem ida a
    rede); se o segredo nao estiver configurado ou a assinatura nao bater, cai
    no caminho remoto do `auth_service`.
    """
    try:
        supabase_id, email = claims_do_token(token)
    except Exception as erro:
        logger.info("Validacao local do JWT falhou (%s); tentando remota.", erro)
        dados = await auth_service.get_user(token)
        supabase_id, email = dados["id"], dados.get("email")

    return await run_in_threadpool(
        resolve_identity_por_claims, db, supabase_id=supabase_id, email=email
    )


async def get_context(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> RequestContext:
    """
    Dependencia de todo endpoint autenticado. Substitui `get_current_user`.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    token = authorization[len("Bearer ") :]

    try:
        usuario = await resolve_identity(token, db)
    except IdentidadeNaoResolvida:
        # 401, nao 404: para quem chama, "esse token nao vale aqui". Dizer
        # "usuario nao encontrado" confirmaria a existencia de contas.
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    except HTTPException:
        raise
    except Exception as erro:
        logger.warning("Falha ao validar token: %s", erro, exc_info=True)
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")

    entitlements = await run_in_threadpool(
        entitlements_da_conta, db, usuario.account_id
    )
    return RequestContext(
        user_id=usuario.id,
        account_id=usuario.account_id,
        email=usuario.email,
        entitlements=entitlements,
    )

"""
Segurança do portal público de apresentações.

- Hash/verify da senha de acesso do cliente (bcrypt direto — evita o problema
  de compatibilidade do passlib com bcrypt >= 4).
- Token JWT de acesso ao portal, assinado com SECRET_KEY, escopo "portal",
  válido por alguns dias (para o cliente não redigitar a senha a cada visita).
"""
from datetime import datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings

PORTAL_TOKEN_DAYS = 7
_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    # bcrypt limita a 72 bytes; senhas normais ficam bem abaixo disso.
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_portal_token(presentation_id: str, days: int = PORTAL_TOKEN_DAYS) -> str:
    payload = {
        "sub": str(presentation_id),
        "scope": "portal",
        "exp": datetime.utcnow() + timedelta(days=days),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_ALGORITHM)


def verify_portal_token(token: str, presentation_id: str) -> bool:
    """True se o token for válido, não expirado e emitido para ESTA apresentação."""
    if not token:
        return False
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGORITHM])
    except jwt.PyJWTError:
        return False
    return payload.get("scope") == "portal" and payload.get("sub") == str(presentation_id)

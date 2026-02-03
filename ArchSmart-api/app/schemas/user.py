from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class AccountInfo(BaseModel):
    """Nested schema for account/subscription info"""
    id: UUID
    name: str
    subscription_status: str  # BETA, ACTIVE, CANCELED, READ_ONLY
    plan_name: Optional[str] = None


class UserProfileResponse(BaseModel):
    """Response schema for GET /users/me"""
    id: UUID
    full_name: str
    email: str
    avatar_url: Optional[str] = None
    role: str  # "admin" or "user" - can be expanded later
    account: AccountInfo

    class Config:
        from_attributes = True

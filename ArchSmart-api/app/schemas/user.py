from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class AccountInfo(BaseModel):
    """Nested schema for account/subscription info"""
    id: UUID
    name: str
    subscription_status: str  # BETA, ACTIVE, CANCELED, READ_ONLY
    plan_name: Optional[str] = None
    company_name: Optional[str] = None  # Branding
    logo_url: Optional[str] = None  # Branding


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


class UserProfileUpdate(BaseModel):
    """Schema for updating user profile"""
    full_name: str


class ChangePasswordRequest(BaseModel):
    """Schema for changing password"""
    current_password: str
    new_password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserSignup(BaseModel):
    email: str
    password: str
    full_name: str
    cpf: Optional[str] = None


class MagicLinkRequest(BaseModel):
    email: str
    redirect_to: Optional[str] = None
    redirect_url: Optional[str] = None  # Alias for frontend compatibility


class RecoverRequest(BaseModel):
    email: str


class CompleteRegisterRequest(BaseModel):
    full_name: str
    password: str
    access_token: str
    cpf: Optional[str] = None

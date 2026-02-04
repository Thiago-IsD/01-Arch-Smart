from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class AccountBrandingUpdate(BaseModel):
    """Schema for updating account branding"""
    company_name: Optional[str] = None


class AccountBrandingResponse(BaseModel):
    """Response schema for account branding"""
    id: UUID
    name: str
    company_name: Optional[str] = None
    logo_url: Optional[str] = None

    class Config:
        from_attributes = True

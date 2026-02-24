from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

# Client schemas
class ClientBase(BaseModel):
    name: str = Field(..., max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = None

class ClientCreate(ClientBase):
    account_id: UUID

class ClientResponse(ClientBase):
    id: UUID
    account_id: UUID
    
    class Config:
        from_attributes = True

# Project schemas
class ProjectBase(BaseModel):
    name: str = Field(..., max_length=255)
    status: Optional[str] = "ACTIVE"
    service_type: Optional[str] = None
    service_value: Optional[float] = None
    payment_installments: Optional[int] = None

# Payload from the frontend Wizard
class ProjectWizardCreate(BaseModel):
    # Step 1: Project Details
    name: str = Field(..., max_length=255)
    service_type: Optional[str] = None
    
    # Step 2: Client Details
    client_name: str = Field(..., max_length=255)
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    
    # Step 3: Financial Details
    service_value: Optional[float] = None
    payment_installments: Optional[int] = None

class ProjectCreate(ProjectBase):
    account_id: UUID
    client_id: UUID

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    service_type: Optional[str] = None
    service_value: Optional[float] = None
    payment_installments: Optional[int] = None
    client_id: Optional[UUID] = None

class ProjectResponse(ProjectBase):
    id: UUID
    account_id: UUID
    client_id: UUID
    created_at: datetime
    client: Optional[ClientResponse] = None  # Embed client data for the UI Card
    
    class Config:
        from_attributes = True

class PaginatedProjectResponse(BaseModel):
    total: int
    page: int
    size: int
    pages: int
    items: List[ProjectResponse]

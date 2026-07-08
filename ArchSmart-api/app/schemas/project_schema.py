from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date
from uuid import UUID

class CustomInstallment(BaseModel):
    amount: float
    due_date: date
    description: str

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
    payment_method: Optional[str] = "STANDARD"

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
    payment_method: Optional[str] = "STANDARD"
    custom_installments: Optional[List[CustomInstallment]] = None

class ProjectWizardUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = None
    service_type: Optional[str] = None
    
    client_name: Optional[str] = Field(None, max_length=255)
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    
    service_value: Optional[float] = None
    payment_installments: Optional[int] = None
    payment_method: Optional[str] = None
    custom_installments: Optional[List[CustomInstallment]] = None

class ProjectCreate(ProjectBase):
    account_id: UUID
    client_id: UUID

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    service_type: Optional[str] = None
    service_value: Optional[float] = None
    payment_installments: Optional[int] = None
    payment_method: Optional[str] = None
    client_id: Optional[UUID] = None

class ProjectResponse(ProjectBase):
    id: UUID
    account_id: UUID
    client_id: UUID
    created_at: datetime
    environments_count: int = 0
    client: Optional[ClientResponse] = None  # Embed client data for the UI Card
    
    class Config:
        from_attributes = True

class PaginatedProjectResponse(BaseModel):
    total: int
    page: int
    size: int
    pages: int
    items: List[ProjectResponse]
    project_limit: int = 2


from pydantic import BaseModel, ConfigDict, Field, field_validator, computed_field
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime
from app.models.all_models import PresentationStatus
from app.schemas.project_schema import ProjectResponse
from app.schemas.environment_schema import EnvironmentResponse

# --- PresentationEnvironment ---

class PresentationEnvironmentBase(BaseModel):
    is_visible: bool = True

class PresentationEnvironmentCreate(PresentationEnvironmentBase):
    environment_id: UUID

class PresentationEnvironmentUpdate(PresentationEnvironmentBase):
    pass

class PresentationEnvironmentResponse(PresentationEnvironmentBase):
    id: UUID
    presentation_id: UUID
    environment_id: UUID
    environment: Optional[EnvironmentResponse] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    image_urls: Optional[List[str]] = Field(default_factory=list)

    @field_validator("image_urls", mode="before")
    @classmethod
    def coerce_image_urls(cls, v):
        if v is None:
            return []
        return v

    model_config = ConfigDict(from_attributes=True)

class PresentationEnvironmentDetailUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    is_visible: Optional[bool] = None

# --- Presentation ---

class PresentationBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: PresentationStatus = PresentationStatus.DRAFT
    branding_snapshot: Optional[Any] = None

class PresentationCreate(PresentationBase):
    project_id: UUID

class PresentationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[PresentationStatus] = None
    branding_snapshot: Optional[Any] = None

class EnvironmentVisibilityUpdate(BaseModel):
    id: UUID
    is_visible: bool

class PresentationConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[PresentationStatus] = None
    environments: Optional[List[EnvironmentVisibilityUpdate]] = None
    branding_snapshot: Optional[Any] = None

class PresentationResponse(PresentationBase):
    id: UUID
    project_id: UUID
    created_at: datetime
    environments: List[PresentationEnvironmentResponse] = []

    # Includings project data for global list
    project: Optional[ProjectResponse] = None

    # Hash lido do ORM mas nunca serializado (exclude=True) — só alimenta o
    # computed_field abaixo, para o builder saber se já existe senha configurada.
    access_password_hash: Optional[str] = Field(default=None, exclude=True)

    @computed_field
    @property
    def has_access_password(self) -> bool:
        return bool(self.access_password_hash)

    model_config = ConfigDict(from_attributes=True)

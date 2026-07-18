from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class EnvironmentDNABase(BaseModel):
    floor_area: float = Field(0.0, ge=0.0)
    wall_area: float = Field(0.0, ge=0.0)
    ceiling_area: float = Field(0.0, ge=0.0)

class EnvironmentDNAUpdate(EnvironmentDNABase):
    pass

class EnvironmentDNAResponse(EnvironmentDNABase):
    id: UUID
    environment_id: UUID
    is_complete: bool

    model_config = ConfigDict(from_attributes=True)

class EnvironmentBase(BaseModel):
    name: str = Field(..., min_length=1)
    type: Optional[str] = None

class EnvironmentCreate(EnvironmentBase):
    # DNA opcional já no cadastro — permite preencher as áreas na primeira
    # iteração, sem precisar entrar no ambiente depois. Se omitido, inicia zerado.
    dna: Optional[EnvironmentDNABase] = None

class EnvironmentResponse(EnvironmentBase):
    id: UUID
    project_id: UUID
    created_at: datetime
    dna: Optional[EnvironmentDNAResponse] = None

    model_config = ConfigDict(from_attributes=True)

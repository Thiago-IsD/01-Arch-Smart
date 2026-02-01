from pydantic import BaseModel
from typing import Optional

class LeadCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    active_projects: Optional[int] = None
    origin: Optional[str] = "SITE"

from pydantic import BaseModel, UUID4
from typing import List, Optional

class RecentProject(BaseModel):
    id: UUID4
    name: str
    client_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class RecentProduct(BaseModel):
    id: UUID4
    name: str
    image_url: Optional[str] = None
    
    class Config:
        from_attributes = True

class DashboardLeanResponse(BaseModel):
    user_first_name: str
    recent_projects: List[RecentProject]
    recent_products: List[RecentProduct]

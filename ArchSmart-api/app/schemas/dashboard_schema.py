from pydantic import BaseModel, ConfigDict, UUID4
from typing import List, Optional
from datetime import datetime

class RecentProject(BaseModel):
    id: UUID4
    name: str
    client_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class RecentProduct(BaseModel):
    id: UUID4
    name: str
    image_url: Optional[str] = None
    price: Optional[float] = None
    store: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class UpcomingEvent(BaseModel):
    id: UUID4
    title: str
    start_time: datetime
    end_time: datetime
    meet_link: Optional[str] = None
    project_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class DashboardLeanResponse(BaseModel):
    user_first_name: str
    recent_projects: List[RecentProject]
    recent_products: List[RecentProduct]
    active_projects_count: int
    financial_balance: float
    financial_income: float
    financial_expense: float
    upcoming_events: List[UpcomingEvent]

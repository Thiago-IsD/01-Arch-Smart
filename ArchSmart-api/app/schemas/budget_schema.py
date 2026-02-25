from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.all_models import RuleType
from app.schemas.product_schema import ProductResponse

# Environment Nested Schema for responses
class EnvironmentBaseForBudget(BaseModel):
    id: UUID
    name: str
    type: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ItemOptionResponse(BaseModel):
    id: UUID
    budget_item_id: UUID
    product_id: Optional[UUID] = None
    is_selected: bool
    product: Optional[ProductResponse] = None
    
    model_config = ConfigDict(from_attributes=True)

class BudgetItemResponse(BaseModel):
    id: UUID
    budget_id: UUID
    environment_id: Optional[UUID] = None
    rule_type: RuleType
    manual_quantity: Optional[int] = None
    environment: Optional[EnvironmentBaseForBudget] = None
    options: List[ItemOptionResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

class BudgetResponse(BaseModel):
    id: UUID
    project_id: UUID
    total_value: Optional[float] = None
    items: List[BudgetItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

# Payload from the frontend to insert into the budget
class BudgetItemCreate(BaseModel):
    project_id: UUID
    environment_id: UUID
    product_id: UUID
    rule_type: RuleType

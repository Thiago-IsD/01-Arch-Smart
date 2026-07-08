from typing import Optional, Any, Dict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.all_models import ProductStateStatus, ProductOriginType

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    store: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    markup: Optional[float] = None
    dimensions: Optional[Dict[str, Any]] = None # {width, height, depth, unit}
    yield_factor: Optional[float] = None # Rendimento para motores de orçamento
    image_url: Optional[str] = None
    source_url: Optional[str] = None
    origin_id: Optional[UUID] = None
    state_id: Optional[UUID] = None

class ProductCreate(ProductBase):
    account_id: Optional[UUID] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    store: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    markup: Optional[float] = None
    dimensions: Optional[Dict[str, Any]] = None
    yield_factor: Optional[float] = None
    image_url: Optional[str] = None
    source_url: Optional[str] = None
    state_id: Optional[UUID] = None

class ProductStateSchema(BaseModel):
    id: UUID
    name: str
    status: ProductStateStatus

    model_config = ConfigDict(from_attributes=True)

class ProductOriginSchema(BaseModel):
    id: UUID
    name: str
    type: ProductOriginType

    model_config = ConfigDict(from_attributes=True)

class ProductResponse(ProductBase):
    id: UUID
    account_id: UUID
    created_at: Optional[datetime] = None
    state: Optional[ProductStateSchema] = None
    origin: Optional[ProductOriginSchema] = None
    
    model_config = ConfigDict(from_attributes=True)

class PaginatedProductResponse(BaseModel):
    total: int
    page: int
    size: int
    pages: int
    items: list[ProductResponse]

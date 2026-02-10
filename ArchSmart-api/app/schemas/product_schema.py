from typing import Optional, Any, Dict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.all_models import ProductStateStatus, ProductOriginType

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    store: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    dimensions: Optional[Dict[str, Any]] = None # {width, height, depth, unit}
    image_url: Optional[str] = None
    origin_id: Optional[UUID] = None
    state_id: Optional[UUID] = None

class ProductCreate(ProductBase):
    account_id: UUID

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    store: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    dimensions: Optional[Dict[str, Any]] = None
    image_url: Optional[str] = None
    state_id: Optional[UUID] = None

class ProductStateSchema(BaseModel):
    id: UUID
    name: str
    status: ProductStateStatus

    class Config:
        from_attributes = True

class ProductOriginSchema(BaseModel):
    id: UUID
    name: str
    type: ProductOriginType

    class Config:
        from_attributes = True

class ProductResponse(ProductBase):
    id: UUID
    account_id: UUID
    created_at: Optional[datetime] = None
    state: Optional[ProductStateSchema] = None
    origin: Optional[ProductOriginSchema] = None
    
    class Config:
        from_attributes = True

class PaginatedProductResponse(BaseModel):
    total: int
    page: int
    size: int
    pages: int
    items: list[ProductResponse]

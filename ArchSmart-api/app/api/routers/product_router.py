from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
import time
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.all_models import Product, ProductState, ProductStateStatus, ProductOrigin, ProductOriginType, Account
from app.schemas.product_schema import ProductCreate, ProductUpdate, ProductResponse, PaginatedProductResponse
from app.api.dependencies.auth import get_current_user
from app.models.all_models import User

router = APIRouter()

@router.get("/seed-captured")
def seed_captured(db: Session = Depends(get_db)):
    account = db.query(Account).first()
    if not account:
        account = Account(name="Demo Account", company_name="Arch Smart Demo")
        db.add(account)
        db.commit()
        db.refresh(account)

    captured_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.CAPTURED).first()
    if not captured_state:
        captured_state = ProductState(name="Captured", status=ProductStateStatus.CAPTURED)
        db.add(captured_state)
        
    clipper_origin = db.query(ProductOrigin).filter(ProductOrigin.type == ProductOriginType.WEB_CLIPPER).first()
    if not clipper_origin:
        clipper_origin = ProductOrigin(name="Web Clipper", type=ProductOriginType.WEB_CLIPPER)
        db.add(clipper_origin)

    db.commit()
    db.refresh(captured_state)
    db.refresh(clipper_origin)

    p1 = Product(
        account_id=account.id,
        name="Sofa Modular Cinza (Bruto)",
        store="Tok&Stok",
        category=None,
        price=3200.00,
        image_url="https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=500",
        state_id=captured_state.id,
        origin_id=clipper_origin.id,
        dimensions=None
    )

    p2 = Product(
        account_id=account.id,
        name="Luminária Pendente Industrial",
        store="Westwing",
        category="Iluminação",
        price=None,
        image_url="https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&q=80&w=500",
        state_id=captured_state.id,
        origin_id=clipper_origin.id,
        dimensions=None
    )

    db.add(p1)
    db.add(p2)
    db.commit()
    return {"message": "Captured products seeded successfully"}

@router.get("/", response_model=PaginatedProductResponse)
def get_products(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(15, ge=1, le=100, description="Items per page"),
    state: ProductStateStatus = ProductStateStatus.NORMALIZED,
    q: Optional[str] = Query(None, description="Search by name or store"),
    categories: Optional[List[str]] = Query(None, description="Filter by categories"),
    origins: Optional[List[str]] = Query(None, description="Filter by origins"),
    sort_by: Optional[str] = Query("created_at_desc", description="Sort products"),
    db: Session = Depends(get_db),
):
    query = db.query(Product).join(ProductState).filter(ProductState.status == state)

    if q:
        search = f"%{q}%"
        query = query.filter(
            (Product.name.ilike(search)) | 
            (Product.store.ilike(search))
        )
    
    if categories:
        query = query.filter(Product.category.in_(categories))
        
    if origins:
        query = query.join(ProductOrigin).filter(ProductOrigin.name.in_(origins))

    # Total count before pagination
    total = query.count()

    # Sorting
    if sort_by == "name_asc":
        query = query.order_by(Product.name.asc())
    elif sort_by == "name_desc":
        query = query.order_by(Product.name.desc())
    elif sort_by == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Product.price.desc())
    else: # created_at_desc (default)
        query = query.order_by(Product.created_at.desc())

    # Pagination
    skip = (page - 1) * size
    products = query.offset(skip).limit(size).all()
    
    # Calculate total pages
    import math
    pages = math.ceil(total / size) if size > 0 else 0

    return {
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
        "items": products
    }

@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: UUID, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

from app.services.ai_service import extract_product_data

class NormalizeRequest(BaseModel):
    text: str = ""
    source_url: Optional[str] = None

class NormalizeResponse(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    dimensions: Optional[Dict[str, float]] = None

@router.post("/normalize", response_model=NormalizeResponse)
async def normalize_product(request: NormalizeRequest):
    try:
        extracted_data = await extract_product_data(request.text, request.source_url)
        return extracted_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ProductResponse)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    # Verify/Get State ID provided or Default to NORMALIZED
    state_id = product.state_id
    if not state_id:
        normalized_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.NORMALIZED).first()
        if not normalized_state:
            # Fallback or initialization if not exists
             normalized_state = ProductState(name="Normalized", status=ProductStateStatus.NORMALIZED)
             db.add(normalized_state)
             db.commit()
             db.refresh(normalized_state)
        state_id = normalized_state.id

    # Verify/Get Origin ID provided or Default to MANUAL
    origin_id = product.origin_id
    if not origin_id:
        manual_origin = db.query(ProductOrigin).filter(ProductOrigin.type == ProductOriginType.MANUAL).first()
        if not manual_origin:
             manual_origin = ProductOrigin(name="Manual", type=ProductOriginType.MANUAL)
             db.add(manual_origin)
             db.commit()
             db.refresh(manual_origin)
        origin_id = manual_origin.id

    product_data = product.dict(exclude={'state_id', 'origin_id'})
    # Ensure account_id is set if not in product_data but in product object (it is in ProductCreate)
    
    db_product = Product(
        **product_data,
        state_id=state_id,
        origin_id=origin_id
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: UUID, product_update: ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)
    return db_product

@router.delete("/{product_id}")
def delete_product(product_id: UUID, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Soft delete: Set state to INACTIVE
    inactive_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.INACTIVE).first()
    if not inactive_state:
        inactive_state = ProductState(name="Inactive", status=ProductStateStatus.INACTIVE)
        db.add(inactive_state)
        db.commit()
        db.refresh(inactive_state)

    db_product.state_id = inactive_state.id
    db.commit()
    return {"ok": True}

@router.patch("/{product_id}/approve", response_model=ProductResponse)
def approve_product(product_id: UUID, product_update: ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update fields
    update_data = product_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
        
    # Set status to NORMALIZED
    normalized_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.NORMALIZED).first()
    if not normalized_state:
        normalized_state = ProductState(name="Normalized", status=ProductStateStatus.NORMALIZED)
        db.add(normalized_state)
        db.commit()
        db.refresh(normalized_state)
        
    db_product.state_id = normalized_state.id
    db.commit()
    db.refresh(db_product)
    db.refresh(db_product)
    return db_product

class ClipperCaptureRequest(BaseModel):
    name: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None

@router.post("/clipper/capture", status_code=201)
async def clipper_capture(
    request: ClipperCaptureRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Get State
        captured_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.CAPTURED).first()
        if not captured_state:
            captured_state = ProductState(name="Captured", status=ProductStateStatus.CAPTURED)
            db.add(captured_state)
            
        # Get Origin
        clipper_origin = db.query(ProductOrigin).filter(ProductOrigin.type == ProductOriginType.WEB_CLIPPER).first()
        if not clipper_origin:
            clipper_origin = ProductOrigin(name="Web Clipper", type=ProductOriginType.WEB_CLIPPER)
            db.add(clipper_origin)
            
        db.commit()
        
        import uuid
        new_product = Product(
            account_id=current_user.account_id,
            name=request.name[:255] if request.name else "Captura sem título",
            store=None,  # Or parse from URL later
            source_url=request.source_url,
            image_url=request.image_url,
            state_id=captured_state.id,
            origin_id=clipper_origin.id,
            codigo=str(uuid.uuid4())[:8].upper()
        )
        db.add(new_product)
        db.commit()
        db.refresh(new_product)
        return {"status": "success", "product_id": str(new_product.id)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.all_models import Product, ProductState, ProductStateStatus, ProductOrigin, ProductOriginType
from app.schemas.product_schema import ProductCreate, ProductUpdate, ProductResponse, PaginatedProductResponse

router = APIRouter()

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

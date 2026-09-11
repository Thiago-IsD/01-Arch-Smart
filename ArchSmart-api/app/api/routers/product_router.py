import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request
import time
from pydantic import BaseModel
from sqlalchemy import func
from app.core.errors import ValidacaoDeDominio
from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Product, ProductState, ProductStateStatus, ProductOrigin, ProductOriginType, AiUsageLog
from app.schemas.product_schema import ProductCreate, ProductUpdate, ProductResponse, PaginatedProductResponse
from app.core.rate_limit import limiter

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=PaginatedProductResponse)
def get_products(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(15, ge=1, le=100, description="Items per page"),
    state: ProductStateStatus = ProductStateStatus.NORMALIZED,
    q: Optional[str] = Query(None, description="Search by name or store"),
    categories: Optional[List[str]] = Query(None, description="Filter by categories"),
    origins: Optional[List[str]] = Query(None, description="Filter by origins"),
    sort_by: Optional[str] = Query("created_at_desc", description="Sort products"),
    repo: ScopedRepository = Depends(get_repo),
):
    query = repo.query(Product).join(ProductState).filter(
        ProductState.status == state,
    )

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
def get_product(
    product_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    return repo.obter(Product, product_id)

from app.services.ai_service import (
    AIConfigError,
    AIQuotaError,
    AIResponseError,
    AITimeoutError,
    extract_product_data,
)
from app.core.precos_ia import custo_usd

class NormalizeRequest(BaseModel):
    text: str = ""
    source_url: Optional[str] = None

class NormalizeResponse(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    dimensions: Optional[Dict[str, float]] = None
    yield_factor: Optional[float] = None
    # True quando nem nós nem o Google conseguimos ler a página: os dados vieram só do nome
    # e precisam de revisão manual. Não é erro, é extração parcial.
    source_blocked: bool = False

# Cada falha da IA vira um status e uma mensagem própria. Antes, um except genérico
# devolvia "Erro de conexão com IA" para tudo — inclusive erros de validação —, o que
# fazia um bug de schema parecer problema de rede.
AI_ERROR_RESPONSES = {
    AIConfigError: (503, "Serviço de IA indisponível no momento. Contate o suporte."),
    AIQuotaError: (429, "Limite de uso da IA atingido. Tente novamente em instantes."),
    AITimeoutError: (504, "A IA demorou demais para responder. Tente novamente."),
    AIResponseError: (502, "A IA retornou dados em formato inesperado. Tente novamente."),
}

@router.post("/normalize", response_model=NormalizeResponse)
@limiter.limit("20/minute")
async def normalize_product(
    request: Request,
    payload: NormalizeRequest,
    repo: ScopedRepository = Depends(get_repo),
):
    try:
        dados, uso = await extract_product_data(payload.text, payload.source_url)
    except tuple(AI_ERROR_RESPONSES) as e:
        status_code, detail = AI_ERROR_RESPONSES[type(e)]
        raise HTTPException(status_code=status_code, detail=detail)

    # Art. 9: na MESMA transacao da resposta, sem savepoint e sem engolir. Se o
    # registro de custo falhar, a requisicao falha — nao se serve resposta de IA
    # sem registrar o que ela custou. E o oposto de `track()`, de proposito.
    repo.create(
        AiUsageLog,
        model_name=uso.model_name,
        input_tokens=uso.input_tokens,
        output_tokens=uso.output_tokens,
        token_count=uso.input_tokens + uso.output_tokens,
        cost_usd=custo_usd(uso.model_name, uso.input_tokens, uso.output_tokens),
        latency_ms=uso.latency_ms,
        feature="product_normalize",
    )
    repo.db.commit()

    return dados

@router.post("/", response_model=ProductResponse)
def create_product(
    product: ProductCreate,
    repo: ScopedRepository = Depends(get_repo),
):
    db = repo.db

    # Verify/Get State ID provided or Default to NORMALIZED
    state_id = product.state_id
    if not state_id:
        # Catalogo global: product_states nao tem account_id, entao
        # repo.query() levantaria EscopoImpossivel. Excecao deliberada, nao
        # esquecimento.
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
        # Catalogo global: product_origins nao tem account_id, entao
        # repo.query() levantaria EscopoImpossivel. Excecao deliberada, nao
        # esquecimento.
        manual_origin = db.query(ProductOrigin).filter(ProductOrigin.type == ProductOriginType.MANUAL).first()
        if not manual_origin:
             manual_origin = ProductOrigin(name="Manual", type=ProductOriginType.MANUAL)
             db.add(manual_origin)
             db.commit()
             db.refresh(manual_origin)
        origin_id = manual_origin.id

    # Ensure we use the latest Pydantic V2 method
    product_data = product.model_dump(exclude={'state_id', 'origin_id', 'account_id'})

    db_product = repo.create(
        Product,
        **product_data,
        state_id=state_id,
        origin_id=origin_id,
    )
    db.commit()
    db.refresh(db_product)
    return db_product

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: UUID,
    product_update: ProductUpdate,
    repo: ScopedRepository = Depends(get_repo),
):
    db_product = repo.obter(Product, product_id)

    update_data = product_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)

    repo.db.commit()
    repo.db.refresh(db_product)
    return db_product

@router.delete("/{product_id}")
def delete_product(
    product_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    db_product = repo.obter(Product, product_id)
    db = repo.db

    # Soft delete: Set state to INACTIVE
    # Catalogo global: product_states nao tem account_id, entao repo.query()
    # levantaria EscopoImpossivel. Excecao deliberada, nao esquecimento.
    inactive_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.INACTIVE).first()
    if not inactive_state:
        inactive_state = ProductState(name="Inactive", status=ProductStateStatus.INACTIVE)
        db.add(inactive_state)
        db.commit()
        db.refresh(inactive_state)

    db_product.state_id = inactive_state.id
    db.commit()
    return {"ok": True}

class BatchApproveItem(BaseModel):
    id: UUID
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    dimensions: Optional[Dict[str, Any]] = None
    yield_factor: Optional[float] = None
    source_url: Optional[str] = None

class BatchApproveRequest(BaseModel):
    items: List[BatchApproveItem]

class BatchApproveResponse(BaseModel):
    approved: List[UUID]
    not_found: List[UUID]

@router.patch("/batch-approve", response_model=BatchApproveResponse)
def batch_approve_products(
    payload: BatchApproveRequest,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Aprova (normaliza) varios produtos capturados de uma vez, em um unico
    round-trip. Aplica os campos editados de cada item e move para NORMALIZED.
    Ignora itens que nao existem/nao pertencem a conta (retornados em not_found).
    """
    db = repo.db
    # Catalogo global: product_states nao tem account_id, entao repo.query()
    # levantaria EscopoImpossivel. Excecao deliberada, nao esquecimento.
    normalized_state = db.query(ProductState).filter(
        ProductState.status == ProductStateStatus.NORMALIZED
    ).first()
    if not normalized_state:
        normalized_state = ProductState(name="Normalized", status=ProductStateStatus.NORMALIZED)
        db.add(normalized_state)
        db.commit()
        db.refresh(normalized_state)

    approved: List[UUID] = []
    not_found: List[UUID] = []

    for item in payload.items:
        db_product = repo.get(Product, item.id)
        if not db_product:
            not_found.append(item.id)
            continue

        update_data = item.model_dump(exclude_unset=True, exclude={"id"})
        for key, value in update_data.items():
            setattr(db_product, key, value)
        db_product.state_id = normalized_state.id
        approved.append(item.id)

    db.commit()
    return BatchApproveResponse(approved=approved, not_found=not_found)

@router.patch("/{product_id}/approve", response_model=ProductResponse)
def approve_product(
    product_id: UUID,
    product_update: ProductUpdate,
    repo: ScopedRepository = Depends(get_repo),
):
    db_product = repo.obter(Product, product_id)
    db = repo.db

    # Update fields
    update_data = product_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)

    # Set status to NORMALIZED
    # Catalogo global: product_states nao tem account_id, entao repo.query()
    # levantaria EscopoImpossivel. Excecao deliberada, nao esquecimento.
    normalized_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.NORMALIZED).first()
    if not normalized_state:
        normalized_state = ProductState(name="Normalized", status=ProductStateStatus.NORMALIZED)
        db.add(normalized_state)
        db.commit()
        db.refresh(normalized_state)

    db_product.state_id = normalized_state.id
    db.commit()
    db.refresh(db_product)
    return db_product

class ClipperCaptureRequest(BaseModel):
    name: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    dimensions: Optional[Dict[str, float]] = None
    yield_factor: Optional[float] = None

@router.post("/clipper/capture", status_code=201)
async def clipper_capture(
    request: ClipperCaptureRequest,
    repo: ScopedRepository = Depends(get_repo),
):
    db = repo.db
    try:
        # Get State
        # Catalogo global: product_states nao tem account_id, entao
        # repo.query() levantaria EscopoImpossivel. Excecao deliberada, nao
        # esquecimento.
        captured_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.CAPTURED).first()
        if not captured_state:
            captured_state = ProductState(name="Captured", status=ProductStateStatus.CAPTURED)
            db.add(captured_state)

        # Get Origin
        # Catalogo global: product_origins nao tem account_id, entao
        # repo.query() levantaria EscopoImpossivel. Excecao deliberada, nao
        # esquecimento.
        clipper_origin = db.query(ProductOrigin).filter(ProductOrigin.type == ProductOriginType.WEB_CLIPPER).first()
        if not clipper_origin:
            clipper_origin = ProductOrigin(name="Web Clipper", type=ProductOriginType.WEB_CLIPPER)
            db.add(clipper_origin)

        db.commit()

        new_product = repo.create(
            Product,
            name=request.name[:255] if request.name else "Captura sem título",
            store=None,  # Or parse from URL later
            source_url=request.source_url,
            dimensions=request.dimensions,
            yield_factor=request.yield_factor,
            image_url=request.image_url,
            state_id=captured_state.id,
            origin_id=clipper_origin.id
        )
        db.commit()
        db.refresh(new_product)
        return {"status": "success", "product_id": str(new_product.id)}
    except Exception as e:
        db.rollback()
        logger.error("Falha ao processar produto capturado", exc_info=e)
        raise ValidacaoDeDominio("Não foi possível processar o produto.")

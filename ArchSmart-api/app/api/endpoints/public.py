"""
Endpoint público (sem autenticação) para o Portal do Cliente.
GET /public/presentations/{uuid}
"""
import uuid as uuid_module
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.db.session import get_db
from app.models.all_models import (
    Presentation, PresentationEnvironment, Environment,
    Project, Budget, BudgetItem, ItemOption, Product,
    PresentationAcceptance, Notification, PresentationComment
)
from app.services.budget_calculator import calculate_budget_item_quantity
from app.utils.supabase_client import get_storage_client

router = APIRouter()

# ==================== Schemas de Resposta Públicos ====================

class AcceptRequest(BaseModel):
    accepted: bool
    feedback: Optional[str] = None
    selected_options: Dict[str, Any] = {}


class PublicProductInfo(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = "Produto"
    store: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    source_url: Optional[str] = None

    model_config = {"from_attributes": True}

class PublicOptionInfo(BaseModel):
    id: Optional[str] = None
    is_selected: bool = False
    product: Optional[PublicProductInfo] = None

    model_config = {"from_attributes": True}

class PublicBudgetItemInfo(BaseModel):
    id: Optional[str] = None
    environment_id: Optional[str] = None
    rule_type: Optional[str] = "UNIT"
    calculated_quantity: Optional[float] = 0
    manual_quantity: Optional[int] = None
    options: List[PublicOptionInfo] = []

    model_config = {"from_attributes": True}

class PublicEnvironmentInfo(BaseModel):
    id: Optional[str] = None
    environment_id: Optional[str] = None
    environment_name: Optional[str] = "Ambiente"
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    image_urls: List[str] = []
    
    model_config = {"from_attributes": True}

class PublicBrandingInfo(BaseModel):
    office_name: Optional[str] = "Arch Smart"
    logo_url: Optional[str] = None
    cover_url: Optional[str] = None
    
    model_config = {"from_attributes": True}

class PublicPresentationResponse(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = "Sem Nome"
    description: Optional[str] = None
    status: Optional[str] = "DRAFT"
    branding: PublicBrandingInfo
    environments: List[PublicEnvironmentInfo] = []
    budget_items: List[PublicBudgetItemInfo] = []
    
    model_config = {"from_attributes": True}


# ==================== Endpoint ====================

@router.get("/presentations/{presentation_uuid}", response_model=PublicPresentationResponse)
async def get_public_presentation(
    presentation_uuid: str,
    db: Session = Depends(get_db)
):
    """
    Endpoint público (sem JWT) para o Portal do Cliente.
    Retorna a apresentação com ambientes visíveis e itens de orçamento filtrados.
    """
    # 1. Validar UUID manualmente para evitar 422 automático do FastAPI em entradas mal formatadas
    try:
        uuid_obj = uuid_module.UUID(presentation_uuid)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de apresentação inválido")

    # 2. Buscar apresentação com relacionamentos
    presentation = (
        db.query(Presentation)
        .options(
            joinedload(Presentation.project).joinedload(Project.account),
            joinedload(Presentation.environments).joinedload(PresentationEnvironment.environment)
        )
        .filter(Presentation.id == uuid_obj)
        .first()
    )

    if not presentation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apresentação não encontrada")

    # 3. Filtrar apenas ambientes visíveis
    visible_envs = [e for e in presentation.environments if e.is_visible]
    visible_env_real_ids = [e.environment_id for e in visible_envs if e.environment_id]

    # 4. Montar branding a partir do branding_snapshot (com fallback para Account)
    branding_snapshot = presentation.branding_snapshot or {}
    
    # Fallback para dados da conta se o snapshot estiver vazio
    office_name = branding_snapshot.get("office_name")
    logo_url = branding_snapshot.get("logo_url")
    
    if not office_name or not logo_url:
        account = presentation.project.account if presentation.project else None
        if account:
            if not office_name:
                office_name = account.company_name or account.name
            if not logo_url:
                logo_url = account.logo_url

    # Assinar a URL da logo se for um caminho interno (Supabase Storage)
    if logo_url and not logo_url.startswith("http"):
        try:
            storage_client = get_storage_client()
            # Usando bucket 'secure-files' que é onde as logos costumam ficar, ou inferindo
            # Se o logo_url não tem bucket, assumimos 'secure-files'
            bucket = "secure-files"
            path = logo_url
            if "/" in logo_url and not logo_url.startswith("presentations/"):
                 # Logica simples: se tem barra e não é apresentação, pode já ter o bucket no path
                 pass
            
            signed_url = await storage_client.create_signed_url(bucket, path, expires_in=31536000) # 1 ano
            if signed_url:
                logo_url = signed_url
        except Exception as e:
            print(f"⚠️ Erro ao assinar logo no portal público: {e}")

    branding = PublicBrandingInfo(
        office_name=office_name or "Arch Smart",
        logo_url=logo_url,
        cover_url=branding_snapshot.get("cover_url"),
    )

    # 5. Serializar ambientes visíveis
    env_list = []
    for pe in visible_envs:
        env_list.append(PublicEnvironmentInfo(
            id=str(pe.id),
            environment_id=str(pe.environment_id),
            environment_name=pe.environment.name if pe.environment else "Ambiente",
            title=pe.title,
            subtitle=pe.subtitle,
            description=pe.description,
            image_urls=pe.image_urls or [],
        ))

    # 6. Buscar budget do projeto e filtrar itens pelos ambientes visíveis
    budget_items_result: List[PublicBudgetItemInfo] = []

    if presentation.project_id and visible_env_real_ids:
        budget = db.query(Budget).filter(Budget.project_id == presentation.project_id).first()

        if budget:
            items = (
                db.query(BudgetItem)
                .options(
                    joinedload(BudgetItem.options).joinedload(ItemOption.product)
                )
                .filter(
                    BudgetItem.budget_id == budget.id,
                    BudgetItem.environment_id.in_(visible_env_real_ids)
                )
                .all()
            )

            for item in items:
                # Calcular quantidade de forma segura
                try:
                    calc = calculate_budget_item_quantity(db, item)
                    calculated_qty = calc.get("calculated_quantity")
                except Exception:
                    calculated_qty = 0

                options_out = []
                for opt in item.options:
                    product_out = None
                    if opt.product:
                        product_out = PublicProductInfo(
                            id=str(opt.product.id),
                            name=opt.product.name,
                            store=opt.product.store,
                            price=opt.product.price,
                            image_url=opt.product.image_url,
                            source_url=opt.product.source_url,
                        )
                    options_out.append(PublicOptionInfo(
                        id=str(opt.id),
                        is_selected=opt.is_selected,
                        product=product_out,
                    ))

                budget_items_result.append(PublicBudgetItemInfo(
                    id=str(item.id),
                    environment_id=str(item.environment_id) if item.environment_id else None,
                    rule_type=item.rule_type.value if hasattr(item.rule_type, "value") else str(item.rule_type),
                    calculated_quantity=calculated_qty,
                    manual_quantity=item.manual_quantity,
                    options=options_out,
                ))

    return PublicPresentationResponse(
        id=str(presentation.id),
        name=presentation.name,
        description=presentation.description,
        status=presentation.status.value if hasattr(presentation.status, "value") else str(presentation.status),
        branding=branding,
        environments=env_list,
        budget_items=budget_items_result,
    )


@router.post("/presentations/{presentation_uuid}/options/{option_id}/select")
def select_public_option(
    presentation_uuid: str,
    option_id: uuid_module.UUID,
    db: Session = Depends(get_db)
):
    """
    Permite que o cliente selecione uma opção (A/B) no portal público.
    """
    # 1. Validar apresentação
    presentation = db.query(Presentation).filter(Presentation.id == presentation_uuid).first()
    if not presentation:
        raise HTTPException(status_code=404, detail="Apresentação não encontrada")

    # 2. Buscar a opção e garantir que ela pertence ao projeto da apresentação
    option = (
        db.query(ItemOption)
        .join(BudgetItem)
        .join(Budget)
        .filter(
            ItemOption.id == option_id,
            Budget.project_id == presentation.project_id
        )
        .first()
    )

    if not option:
        raise HTTPException(status_code=404, detail="Opção não encontrada neste projeto")

    # 3. Desmarcar outras opções do mesmo item e marcar esta
    db.query(ItemOption).filter(
        ItemOption.budget_item_id == option.budget_item_id
    ).update({"is_selected": False})

    option.is_selected = True
    db.commit()

    return {"status": "success", "message": "Opção selecionada com sucesso"}

@router.post("/presentations/{presentation_uuid}/accept")
async def accept_public_presentation(
    presentation_uuid: str,
    payload: AcceptRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Registra o aceite ou solicitação de revisão por parte do cliente.
    Gera notificação para o arquiteto.
    """
    presentation = db.query(Presentation).join(Project).filter(Presentation.id == presentation_uuid).first()
    if not presentation:
        raise HTTPException(status_code=404, detail="Apresentação não encontrada")

    if presentation.status in ["ACCEPTED"]:
        raise HTTPException(status_code=400, detail="Apresentação já foi aprovada anteriormente")

    # 1. Atualizar status da Presentation
    new_status = "ACCEPTED" if payload.accepted else "REVISION_REQUESTED"
    presentation.status = new_status
    
    # 2. Gravar o Aceite (Auditoria)
    client_ip = request.client.host if request.client else "unknown"
    
    acceptance = PresentationAcceptance(
        presentation_id=presentation.id,
        accepted=payload.accepted,
        feedback=payload.feedback,
        client_ip=client_ip,
        selected_options_snapshot=payload.selected_options
    )
    db.add(acceptance)
    
    # 2.5: Gravar o comentário inicial da Thread (Se houver feedback escrito)
    if payload.feedback and str(payload.feedback).strip():
        first_comment = PresentationComment(
            presentation_id=presentation.id,
            author_type="CLIENT",
            text=str(payload.feedback).strip()
        )
        db.add(first_comment)
        
    # 3. Gerar Notificação para a conta (Arquiteto)
    # Procuramos o account_id através do Project vinculado à Presentation
    project = presentation.project
    if project and project.account_id:
        title = "Apresentação Aprovada! 🎉" if payload.accepted else "Ajustes Solicitados na Apresentação"
        msg = f"O cliente {'aprovou' if payload.accepted else 'solicitou ajustes para'} a apresentação '{presentation.name}' (Projeto: {project.name})."
        
        notification = Notification(
            account_id=project.account_id,
            title=title,
            message=msg,
        )
        db.add(notification)

    db.commit()

    return {"status": "success", "message": "Feedback registrado com sucesso"}

@router.get("/presentations/{presentation_uuid}/comments")
def get_public_presentation_comments(
    presentation_uuid: str,
    db: Session = Depends(get_db)
):
    """
    Lista a thread de conversas (Comentários) da Apresentação,
    usada pelo Portal do Cliente (Public API).
    """
    presentation = db.query(Presentation).filter(Presentation.id == presentation_uuid).first()
    if not presentation:
        raise HTTPException(status_code=404, detail="Apresentação não encontrada")
        
    comments = db.query(PresentationComment).filter(
        PresentationComment.presentation_id == presentation_uuid
    ).order_by(PresentationComment.created_at.asc()).all()
    
    return [
        {
            "id": c.id,
            "author_type": c.author_type,
            "text": c.text,
            "created_at": c.created_at
        }
        for c in comments
    ]

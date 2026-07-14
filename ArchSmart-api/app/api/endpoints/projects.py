from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any, List
from uuid import UUID

from app.db.session import get_db
from app.api.users import get_current_user
from app.models.all_models import User, Project, Client, Account, Subscription
from app.schemas.project_schema import ProjectResponse, PaginatedProjectResponse, ProjectWizardCreate
from app.services.financial_service import sync_project_financials

router = APIRouter()


def _get_plan_limit(db: Session, account_id) -> int:
    """Returns the max active projects allowed for the account's subscription plan."""
    from app.models.all_models import Subscription, Plan
    sub = db.query(Subscription).filter(Subscription.account_id == account_id).first()
    if sub and sub.plan and sub.plan.limits:
        return int(sub.plan.limits.get("max_active_projects", 2))
    return 2  # fallback: Plano Solo

@router.get("", response_model=PaginatedProjectResponse)
def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = 1,
    size: int = 20,
    search: str = None
) -> Any:
    """
    Lista todos os projetos do arquiteto.
    """
    query = db.query(Project).filter(Project.account_id == current_user.account_id)
    
    if search:
        query = query.filter(Project.name.ilike(f"%{search}%"))
        
    query = query.order_by(Project.created_at.desc())
    
    total = query.count()
    pages = (total + size - 1) // size
    items = query.offset((page - 1) * size).limit(size).all()
    plan_limit = _get_plan_limit(db, current_user.account_id)
    
    return {
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
        "items": items,
        "plan_limit": plan_limit
    }

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_by_id(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Recupera os detalhes de um projeto específico.
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.account_id == current_user.account_id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Projeto não encontrado."
        )
        
    from app.models.all_models import FinancialEntry
    if getattr(project, "payment_method", "STANDARD") == "CUSTOM":
        entries = db.query(FinancialEntry).filter(
            FinancialEntry.project_id == project.id,
            FinancialEntry.type == "INCOME",
            FinancialEntry.status == "PREDICTED"
        ).order_by(FinancialEntry.due_date.asc()).all()
        
        custom_insts = [{"amount": e.amount, "due_date": e.due_date, "description": e.description} for e in entries]
        setattr(project, "custom_installments", custom_insts)
        
    return project

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectWizardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Cria um novo projeto via Wizard (Step 1-3).
    Se o cliente já existir na base pelo email, nós o aproveitamos; caso contrário, criamos.
    Valida limite simulado de projetos do Plano Solo.
    """
    account_id = current_user.account_id
    
    # Validação dinâmica de Limite de Projetos via Plano da Subscription
    plan_limit = _get_plan_limit(db, account_id)
    active_projects_count = db.query(Project).filter(
        Project.account_id == account_id,
        Project.status == "ACTIVE"
    ).count()
    
    if active_projects_count >= plan_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Limite do plano atingido. Você pode ter apenas {plan_limit} projeto(s) ativo(s) simultaneamente."
        )
        
    # Lógica de Cliente Transacional
    client = None
    if data.client_email:
        client = db.query(Client).filter(
            Client.account_id == account_id,
            func.lower(Client.email) == data.client_email.lower().strip()
        ).first()
        
    if not client:
        # Criar Cliente
        client = Client(
            account_id=account_id,
            name=data.client_name,
            email=data.client_email,
            phone=data.client_phone
        )
        db.add(client)
        db.flush() # Gerar o UUID do Client
        
    # Criar o Projeto vinculado a esse cliente
    project = Project(
        account_id=account_id,
        client_id=client.id,
        name=data.name,
        service_type=data.service_type,
        service_value=data.service_value,
        payment_installments=data.payment_installments,
        payment_method=data.payment_method,
        status="ACTIVE"
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Financial Automation Hook
    sync_project_financials(project, db, data.custom_installments)
    
    return project

from app.schemas.project_schema import ProjectWizardUpdate

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    data: ProjectWizardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Atualiza um projeto existente e os dados do cliente vinculado.
    """
    account_id = current_user.account_id
    
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.account_id == account_id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
        
    client = db.query(Client).filter(Client.id == project.client_id).first()
    
    # Update Client
    if client:
        if data.client_name is not None:
            client.name = data.client_name
        if data.client_email is not None:
            client.email = data.client_email
        if data.client_phone is not None:
            client.phone = data.client_phone
            
    # Update Project
    if data.name is not None:
        project.name = data.name
    if data.status is not None:
        project.status = data.status
    if data.service_type is not None:
        project.service_type = data.service_type
    if data.service_value is not None:
        project.service_value = data.service_value
    if data.payment_installments is not None:
        project.payment_installments = data.payment_installments
    if data.payment_method is not None:
        project.payment_method = data.payment_method
        
    db.commit()
    db.refresh(project)
    
    # Financial Automation: re-sync if values changed
    sync_project_financials(project, db, data.custom_installments)
    
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove permanentemente o projeto.
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.account_id == current_user.account_id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
        
    db.delete(project)
    db.commit()
    
    return None

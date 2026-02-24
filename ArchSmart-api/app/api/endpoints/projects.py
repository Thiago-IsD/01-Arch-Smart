from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any, List
from uuid import UUID

from app.db.session import get_db
from app.api.users import get_current_user
from app.models.all_models import User, Project, Client, Account, Subscription
from app.schemas.project_schema import ProjectResponse, PaginatedProjectResponse, ProjectWizardCreate

router = APIRouter()

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
    
    return {
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
        "items": items
    }

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
    
    # Validação do Limite MVP (Plano Solo = máx 2 projetos ATIVOS)
    active_projects_count = db.query(Project).filter(
        Project.account_id == account_id,
        Project.status == "ACTIVE"
    ).count()
    
    if active_projects_count >= 2:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Limite do Plano Solo atingido. Você pode ter apenas 2 projetos ativos simultaneamente."
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
        status="ACTIVE"
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return project

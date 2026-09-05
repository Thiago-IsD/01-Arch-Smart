from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from typing import Any
from uuid import UUID

from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Project, Client
from app.schemas.project_schema import ProjectResponse, PaginatedProjectResponse, ProjectWizardCreate
from app.services.financial_service import sync_project_financials

router = APIRouter()


def _get_plan_limit(repo: ScopedRepository) -> int:
    """
    Fonte unica do limite de projetos: os entitlements que o servidor ja
    resolveu para esta requisicao (Art. 3). Antes daqui esta funcao lia
    Plan.limits["max_active_projects"] por conta propria, enquanto
    /api/users/me publicava Plan.limits["project_limit"] — duas chaves
    diferentes para o mesmo conceito, que so nao divergiam porque nada
    populava Plan.limits.
    """
    return int(repo.ctx.entitlements["project_limit"])

@router.get("", response_model=PaginatedProjectResponse)
def get_projects(
    repo: ScopedRepository = Depends(get_repo),
    page: int = 1,
    size: int = 20,
    search: str = None
) -> Any:
    """
    Lista todos os projetos do arquiteto.
    """
    query = repo.query(Project)

    if search:
        query = query.filter(Project.name.ilike(f"%{search}%"))

    query = query.order_by(Project.created_at.desc())

    total = query.count()
    pages = (total + size - 1) // size
    items = query.offset((page - 1) * size).limit(size).all()
    plan_limit = _get_plan_limit(repo)

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
    repo: ScopedRepository = Depends(get_repo),
) -> Any:
    """
    Recupera os detalhes de um projeto específico.
    """
    project = repo.obter(Project, project_id)

    from app.models.all_models import FinancialEntry
    if getattr(project, "payment_method", "STANDARD") == "CUSTOM":
        entries = repo.query(FinancialEntry).filter(
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
    repo: ScopedRepository = Depends(get_repo),
) -> Any:
    """
    Cria um novo projeto via Wizard (Step 1-3).
    Se o cliente já existir na base pelo email, nós o aproveitamos; caso contrário, criamos.
    Valida limite simulado de projetos do Plano Solo.
    """
    # Validação dinâmica de Limite de Projetos via Plano da Subscription
    plan_limit = _get_plan_limit(repo)
    active_projects_count = repo.query(Project).filter(
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
        client = repo.query(Client).filter(
            func.lower(Client.email) == data.client_email.lower().strip()
        ).first()

    if not client:
        # Criar Cliente
        client = repo.create(
            Client,
            name=data.client_name,
            email=data.client_email,
            phone=data.client_phone,
        )
        repo.db.flush() # Gerar o UUID do Client

    # Criar o Projeto vinculado a esse cliente
    project = repo.create(
        Project,
        client_id=client.id,
        name=data.name,
        service_type=data.service_type,
        service_value=data.service_value,
        payment_installments=data.payment_installments,
        payment_method=data.payment_method,
        status="ACTIVE",
    )

    repo.db.commit()
    repo.db.refresh(project)

    # Financial Automation Hook
    sync_project_financials(project, repo, data.custom_installments)

    return project

from app.schemas.project_schema import ProjectWizardUpdate

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    data: ProjectWizardUpdate,
    repo: ScopedRepository = Depends(get_repo),
) -> Any:
    """
    Atualiza um projeto existente e os dados do cliente vinculado.
    """
    project = repo.obter(Project, project_id)

    client = repo.get(Client, project.client_id)

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

    repo.db.commit()
    repo.db.refresh(project)

    # Financial Automation: re-sync if values changed
    sync_project_financials(project, repo, data.custom_installments)

    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Remove permanentemente o projeto.
    """
    project = repo.obter(Project, project_id)

    repo.remover(project)
    repo.db.commit()

    return None

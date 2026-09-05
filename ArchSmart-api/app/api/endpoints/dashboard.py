from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, extract
from typing import Any
from datetime import datetime

from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Project, Product, Client, Event, FinancialEntry, User
from app.schemas.dashboard_schema import DashboardLeanResponse
from app.api.endpoints.projects import _get_plan_limit

router = APIRouter()

@router.get("/lean", response_model=DashboardLeanResponse)
def get_dashboard_lean(
    repo: ScopedRepository = Depends(get_repo),
) -> Any:
    """
    Retorna os dados essenciais para a dashboard MVP (Launchpad).
    - Últimos 4 projetos ativos
    - Últimos 5 produtos capturados
    - Métricas financeiras e de projetos
    - Próximos compromissos
    """
    # 1. Projetos Recentes (Top 4 ordenados por data de criação)
    projects_query = (
        repo.query(Project)
        .join(Client, Project.client_id == Client.id)
        .filter(Project.status == "ACTIVE")
        .order_by(desc(Project.created_at))
        .with_entities(Project, Client)
        .limit(4)
        .all()
    )

    recent_projects = []
    for proj, client in projects_query:
        recent_projects.append({
            "id": proj.id,
            "name": proj.name,
            "client_name": client.name
        })

    # Contagem de projetos ativos
    active_projects_count = repo.query(Project).filter(
        Project.status == "ACTIVE"
    ).count()

    # Limite de projetos do plano da assinatura (dinâmico)
    plan_limit = _get_plan_limit(repo)

    # 2. Produtos Recentes (Top 5 ordenados por data de criação)
    products_query = repo.query(Product).order_by(
        desc(Product.created_at)
    ).limit(5).all()

    recent_products = []
    for prod in products_query:
        recent_products.append({
            "id": prod.id,
            "name": prod.name,
            "image_url": prod.image_url,
            "price": prod.price,
            "store": prod.store
        })

    # 3. Métricas Financeiras
    # Saldo em Caixa Realizado (tudo REALIZED de INCOME menos EXPENSE)
    balance_query = (
        repo.query(FinancialEntry)
        .filter(FinancialEntry.status == "REALIZED")
        .with_entities(func.sum(FinancialEntry.amount).label("total"), FinancialEntry.type)
        .group_by(FinancialEntry.type)
        .all()
    )

    financial_balance = 0.0
    for total, f_type in balance_query:
        if f_type == "INCOME":
            financial_balance += (total or 0.0)
        elif f_type == "EXPENSE":
            financial_balance -= (total or 0.0)

    # Entradas e Saídas do Mês Atual (PREDICTED e REALIZED)
    now = datetime.now()
    month = now.month
    year = now.year

    monthly_query = (
        repo.query(FinancialEntry)
        .filter(
            extract('month', FinancialEntry.due_date) == month,
            extract('year', FinancialEntry.due_date) == year,
        )
        .with_entities(func.sum(FinancialEntry.amount).label("total"), FinancialEntry.type)
        .group_by(FinancialEntry.type)
        .all()
    )

    financial_income = 0.0
    financial_expense = 0.0
    for total, f_type in monthly_query:
        if f_type == "INCOME":
            financial_income = (total or 0.0)
        elif f_type == "EXPENSE":
            financial_expense = (total or 0.0)

    # 4. Próximos Eventos da Agenda (a partir de hoje)
    events_query = (
        repo.query(Event)
        .outerjoin(Project, Event.project_id == Project.id)
        .filter(Event.start_time >= now)
        .order_by(Event.start_time.asc())
        .with_entities(Event, Project.name.label("project_name"))
        .limit(5)
        .all()
    )

    upcoming_events = []
    for event, pj_name in events_query:
        upcoming_events.append({
            "id": event.id,
            "title": event.title,
            "start_time": event.start_time,
            "end_time": event.end_time,
            "meet_link": event.meet_link,
            "project_name": pj_name
        })

    # RequestContext carrega identidade e entitlements, nao o perfil inteiro
    # do usuario (Art. 1: so o servidor resolve identidade, mas o contrato de
    # RequestContext e deliberadamente minimo) — full_name ainda vem de uma
    # leitura de User, agora por repo.get() em vez do current_user injetado.
    usuario = repo.get(User, repo.ctx.user_id)
    full_name = usuario.full_name if usuario else None

    return {
        "user_first_name": full_name or "Usuário",
        "recent_projects": recent_projects,
        "recent_products": recent_products,
        "active_projects_count": active_projects_count,
        "plan_limit": plan_limit,
        "financial_balance": financial_balance,
        "financial_income": financial_income,
        "financial_expense": financial_expense,
        "upcoming_events": upcoming_events
    }

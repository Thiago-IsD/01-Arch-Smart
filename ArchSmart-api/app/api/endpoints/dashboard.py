from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, extract
from typing import Any
from datetime import datetime

from app.db.session import get_db
from app.api.users import get_current_user
from app.models.all_models import User, Project, Product, Client, Event, FinancialEntry, Subscription, Plan
from app.schemas.dashboard_schema import DashboardLeanResponse

router = APIRouter()

@router.get("/lean", response_model=DashboardLeanResponse)
def get_dashboard_lean(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Retorna os dados essenciais para a dashboard MVP (Launchpad).
    - Últimos 4 projetos ativos
    - Últimos 5 produtos capturados
    - Métricas financeiras e de projetos
    - Próximos compromissos
    """
    account_id = current_user.account_id

    # 1. Projetos Recentes (Top 4 ordenados por data de criação)
    projects_query = db.query(Project, Client).join(
        Client, Project.client_id == Client.id
    ).filter(
        Project.account_id == account_id,
        Project.status == "ACTIVE"
    ).order_by(
        desc(Project.created_at)
    ).limit(4).all()

    recent_projects = []
    for proj, client in projects_query:
        recent_projects.append({
            "id": proj.id,
            "name": proj.name,
            "client_name": client.name
        })

    # Contagem de projetos ativos
    active_projects_count = db.query(Project).filter(
        Project.account_id == account_id,
        Project.status == "ACTIVE"
    ).count()

    # 2. Produtos Recentes (Top 5 ordenados por data de criação)
    products_query = db.query(Product).filter(
        Product.account_id == account_id
    ).order_by(
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
    balance_query = db.query(
        func.sum(FinancialEntry.amount).label("total"),
        FinancialEntry.type
    ).filter(
        FinancialEntry.account_id == account_id,
        FinancialEntry.status == "REALIZED"
    ).group_by(FinancialEntry.type).all()

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

    monthly_query = db.query(
        func.sum(FinancialEntry.amount).label("total"),
        FinancialEntry.type
    ).filter(
        FinancialEntry.account_id == account_id,
        extract('month', FinancialEntry.due_date) == month,
        extract('year', FinancialEntry.due_date) == year
    ).group_by(FinancialEntry.type).all()

    financial_income = 0.0
    financial_expense = 0.0
    for total, f_type in monthly_query:
        if f_type == "INCOME":
            financial_income = (total or 0.0)
        elif f_type == "EXPENSE":
            financial_expense = (total or 0.0)

    # 4. Próximos Eventos da Agenda (a partir de hoje)
    events_query = db.query(Event, Project.name.label("project_name")).outerjoin(
        Project, Event.project_id == Project.id
    ).filter(
        Event.account_id == account_id,
        Event.start_time >= now
    ).order_by(
        Event.start_time.asc()
    ).limit(5).all()

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

    # 5. Buscar limite do plano (Subscription -> Plan -> limits['projects'])
    project_limit = 2
    subscription = db.query(Subscription).filter(Subscription.account_id == account_id).first()
    if subscription and subscription.plan_id:
        plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
        if plan:
            if plan.limits and "projects" in plan.limits:
                project_limit = plan.limits["projects"]
            elif plan.name == "Professional":
                project_limit = 999999

    return {
        "user_first_name": current_user.full_name or "Usuário",
        "recent_projects": recent_projects,
        "recent_products": recent_products,
        "active_projects_count": active_projects_count,
        "financial_balance": financial_balance,
        "financial_income": financial_income,
        "financial_expense": financial_expense,
        "upcoming_events": upcoming_events,
        "project_limit": project_limit
    }

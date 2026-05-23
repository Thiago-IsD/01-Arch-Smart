from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Any

from app.db.session import get_db
from app.api.users import get_current_user
from app.models.all_models import User, Project, Product, Client
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
    """
    account_id = current_user.account_id

    # 1. Projetos Recentes (Top 4 ordenados por data de criação)
    # Trazemos informações do Client junto para pegar o client_name
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
            "image_url": prod.image_url
        })

    return {
        "user_first_name": current_user.full_name or "Usuário",
        "recent_projects": recent_projects,
        "recent_products": recent_products
    }

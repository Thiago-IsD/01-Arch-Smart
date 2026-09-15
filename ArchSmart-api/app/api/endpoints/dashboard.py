from fastapi import APIRouter, Depends
from sqlalchemy import and_, case, desc, extract, func
from typing import Any
from datetime import datetime

from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Project, Product, Client, Event, FinancialEntry
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
    now = datetime.now()

    # 1. Projetos recentes E a contagem de ativos, numa ida so.
    #
    # `count(*) OVER ()` e calculado ANTES do LIMIT: cada uma das ate 4 linhas
    # carrega o total de ativos. Era uma consulta separada, e cada consulta
    # custa 0,17 s na API implantada.
    #
    # ⚠️ Semantica: conta projetos ativos CUJO CLIENTE E DA MESMA CONTA, porque
    # a contagem agora passa pelo JOIN abaixo. A consulta anterior contava todo
    # projeto ativo. Os dois conjuntos so divergem num estado que o schema
    # permite e nenhum caminho de escrita produz — o descrito a seguir.
    #
    # O `Client.account_id == repo.ctx.account_id` no ON e obrigatorio, e nao
    # redundante. `repo.query(Project)` escopa PROJECT; o `with_entities` traz
    # colunas de CLIENT, que o escopo do repositorio nao alcanca - e o
    # `client.name` vai para a resposta logo abaixo. Nenhuma constraint do
    # banco proibe um `projects.client_id` apontando para o cliente de outra
    # conta; hoje nao acontece porque todo caminho que grava esse FK resolve o
    # cliente por `repo.obter`/`repo.get` antes, mas isso e disciplina de
    # codigo, nao invariante de schema. Mesmo padrao de
    # `financial.py::list_financial_entries`.
    linhas_de_projeto = (
        repo.query(Project)
        .join(
            Client,
            and_(
                Project.client_id == Client.id,
                Client.account_id == repo.ctx.account_id,
            ),
        )
        .filter(Project.status == "ACTIVE")
        .order_by(desc(Project.created_at))
        .with_entities(Project.id, Project.name, Client.name, func.count().over())
        .limit(4)
        .all()
    )
    recent_projects = [
        {"id": pid, "name": nome, "client_name": cliente}
        for pid, nome, cliente, _ in linhas_de_projeto
    ]
    active_projects_count = linhas_de_projeto[0][3] if linhas_de_projeto else 0

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

    # 3. Metricas financeiras numa agregacao so.
    #
    # Eram duas: o saldo (so REALIZED, qualquer data) e o mes (qualquer status,
    # so o mes corrente). A soma condicional separa as duas no mesmo SELECT, e o
    # `count` sai de graca para a definicao de "Dashboard vazio" (decisao 3 da
    # spec do Dashboard). `test_lean_devolve_os_mesmos_valores` foi escrito
    # verde contra a versao de duas consultas antes desta troca.
    do_mes = and_(
        extract("month", FinancialEntry.due_date) == now.month,
        extract("year", FinancialEntry.due_date) == now.year,
    )
    linhas_financeiras = (
        repo.query(FinancialEntry)
        .with_entities(
            FinancialEntry.type,
            func.coalesce(
                func.sum(case((FinancialEntry.status == "REALIZED", FinancialEntry.amount), else_=0.0)),
                0.0,
            ),
            func.coalesce(func.sum(case((do_mes, FinancialEntry.amount), else_=0.0)), 0.0),
            func.count(FinancialEntry.id),
        )
        .group_by(FinancialEntry.type)
        .all()
    )

    financial_balance = 0.0
    financial_income = 0.0
    financial_expense = 0.0
    financial_entries_count = 0
    for tipo, realizado, do_mes_total, quantos in linhas_financeiras:
        financial_entries_count += quantos
        if tipo == "INCOME":
            financial_balance += realizado
            financial_income = do_mes_total
        elif tipo == "EXPENSE":
            financial_balance -= realizado
            financial_expense = do_mes_total

    # 4. Próximos Eventos da Agenda (a partir de hoje)
    #
    # A condicao de conta fica no ON, e nao num `.filter()`: com `outerjoin`,
    # movida para o WHERE ela viraria um INNER JOIN disfarcado e sumiria com
    # todo evento sem projeto. No ON, o evento continua aparecendo - so com
    # `project_name` nulo, que e o comportamento certo tanto para "evento sem
    # projeto" quanto para "projeto de outra conta".
    events_query = (
        repo.query(Event)
        .outerjoin(
            Project,
            and_(
                Event.project_id == Project.id,
                Project.account_id == repo.ctx.account_id,
            ),
        )
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

    # `repo.usuario()` custa zero consultas porque o caminho compartilhado
    # (`resolver_identidade_e_entitlements`, app/core/security.py) guarda o
    # User numa referencia FORTE em `db.info[USUARIO_DA_SESSAO]` -- a identity
    # map sozinha so guarda referencia fraca e nao bastaria (ver docstring de
    # `ScopedRepository.usuario` em app/db/repository.py). Vale a mesma ressalva
    # de nao rodar depois de um commit nesta funcao (o objeto expiraria e
    # custaria um refresh).
    full_name = repo.usuario().full_name

    return {
        "user_first_name": full_name or "Usuário",
        "recent_projects": recent_projects,
        "recent_products": recent_products,
        "active_projects_count": active_projects_count,
        "plan_limit": plan_limit,
        "financial_balance": financial_balance,
        "financial_income": financial_income,
        "financial_expense": financial_expense,
        "financial_entries_count": financial_entries_count,
        "upcoming_events": upcoming_events
    }

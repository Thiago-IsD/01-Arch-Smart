"""
Projetos: o contrato da rota e o isolamento entre contas.

Os testes de isolamento sao pares: a conta A ve o dela, e recebe 404 no da B.
404 e nao 403 — um 403 confirmaria que o projeto existe.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Plan, Subscription, SubscriptionStatus
from tests.conftest import criar_projeto


def test_lista_so_os_projetos_da_conta(db: Session, client_a, conta_a, conta_b):
    criar_projeto(db, conta_a[0], "Meu")
    criar_projeto(db, conta_b[0], "Alheio")

    corpo = client_a.get("/api/projects").json()

    assert [p["name"] for p in corpo["items"]] == ["Meu"]


def test_detalhe_de_projeto_alheio_e_404(db: Session, client_a, conta_b):
    alheio = criar_projeto(db, conta_b[0], "Alheio")

    assert client_a.get(f"/api/projects/{alheio.id}").status_code == 404


def test_criar_projeto_grava_a_conta_do_token(db: Session, client_a, conta_a):
    r = client_a.post(
        "/api/projects", json={"name": "Novo", "client_name": "Cliente Novo"}
    )

    assert r.status_code in (200, 201)
    from app.models.all_models import Project

    criado = db.query(Project).filter(Project.name == "Novo").first()
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id


def test_criar_projeto_ignora_account_id_do_corpo(db: Session, client_a, conta_a, conta_b):
    client_a.post(
        "/api/projects",
        json={
            "name": "Tentativa",
            "client_name": "Cliente Tentativa",
            "account_id": str(conta_b[0].id),
        },
    )

    from app.models.all_models import Project

    criado = db.query(Project).filter(Project.name == "Tentativa").first()
    assert criado is None or criado.account_id == conta_a[0].id


def test_limite_de_projetos_vem_dos_entitlements(db: Session, client_a, conta_a):
    """
    `_get_plan_limit` costumava ler `Plan.limits["max_active_projects"]` por
    conta propria, enquanto `entitlements_da_conta` (o que `/api/users/me`
    publica) le `Plan.limits["project_limit"]` — duas chaves para o mesmo
    conceito. So nao divergiam porque nada em produção populava
    `Plan.limits`. Este teste fixa um plano com `project_limit` (a chave que
    os entitlements usam) e prova que a aplicação do limite bate
    com o que a paginação devolve.
    """
    plano = Plan(name="Estudio", limits={"project_limit": 5})
    db.add(plano)
    db.flush()
    db.add(
        Subscription(
            account_id=conta_a[0].id, plan_id=plano.id, status=SubscriptionStatus.ACTIVE
        )
    )
    db.flush()

    for i in range(5):
        criar_projeto(db, conta_a[0], f"Projeto {i}")

    corpo = client_a.get("/api/projects").json()
    assert corpo["plan_limit"] == 5

    r = client_a.post(
        "/api/projects", json={"name": "Sexto", "client_name": "Cliente Sexto"}
    )
    assert r.status_code == 403


def test_apagar_projeto_alheio_e_404(db: Session, client_a, conta_b):
    alheio = criar_projeto(db, conta_b[0], "Alheio")

    assert client_a.delete(f"/api/projects/{alheio.id}").status_code == 404

    from app.models.all_models import Project

    assert db.query(Project).filter(Project.id == alheio.id).first() is not None

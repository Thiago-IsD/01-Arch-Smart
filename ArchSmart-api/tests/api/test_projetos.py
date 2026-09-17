"""
Projetos: o contrato da rota e o isolamento entre contas.

Os testes de isolamento sao pares: a conta A ve o dela, e recebe 404 no da B.
404 e nao 403 — um 403 confirmaria que o projeto existe.
"""
from datetime import date

from sqlalchemy.orm import Session

from app.models.all_models import Client, FinancialEntry, Plan, Project, Subscription, SubscriptionStatus
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


def test_detalhe_com_recebimento_personalizado_devolve_as_parcelas(
    db: Session, client_a, conta_a
):
    """`get_project_by_id` (app/api/endpoints/projects.py:94-108) monta
    `custom_installments` com `setattr`, mas `ProjectResponse` nao declarava o
    campo — o Pydantic descartava o resultado na serializacao (pendencia 4 da
    Secao 8 em CLAUDE.md). O front usa esse campo para preencher o cronograma
    na edicao; sem ele a tela abre vazia e o `superRefine` do wizard reprova o
    salvamento porque a soma das parcelas nao bate com o valor do servico."""
    conta, _ = conta_a
    cliente = Client(account_id=conta.id, name="Cliente Personalizado")
    db.add(cliente)
    db.flush()
    projeto = Project(
        account_id=conta.id,
        client_id=cliente.id,
        name="Projeto Personalizado",
        payment_method="CUSTOM",
        service_value=1000.0,
    )
    db.add(projeto)
    db.flush()
    db.add(
        FinancialEntry(
            account_id=conta.id,
            project_id=projeto.id,
            description="Parcela 0",
            amount=500.0,
            type="INCOME",
            status="PREDICTED",
            due_date=date(2026, 10, 1),
        )
    )
    db.add(
        FinancialEntry(
            account_id=conta.id,
            project_id=projeto.id,
            description="Parcela 1",
            amount=500.0,
            type="INCOME",
            status="PREDICTED",
            due_date=date(2026, 11, 1),
        )
    )
    db.flush()

    corpo = client_a.get(f"/api/projects/{projeto.id}").json()

    assert corpo["payment_method"] == "CUSTOM"
    assert len(corpo["custom_installments"]) == 2
    valores = {p["amount"] for p in corpo["custom_installments"]}
    datas = {p["due_date"] for p in corpo["custom_installments"]}
    assert valores == {500.0}
    assert datas == {"2026-10-01", "2026-11-01"}


def test_detalhe_com_recebimento_padrao_nao_devolve_parcelas(db: Session, client_a, conta_a):
    """Projeto sem `payment_method == "CUSTOM"` nunca consulta `FinancialEntry`
    para o cronograma — o campo tem que sair ausente ou nulo, nunca uma lista
    vazia que o front confundiria com "cronograma zerado"."""
    conta, _ = conta_a
    projeto = criar_projeto(db, conta, "Projeto Padrao")

    corpo = client_a.get(f"/api/projects/{projeto.id}").json()

    assert corpo["payment_method"] == "STANDARD"
    assert corpo.get("custom_installments") is None


def _projeto_custom_com_parcela_recebida(db: Session, conta):
    """3 parcelas de um projeto CUSTOM, a primeira ja REALIZED (recebida)."""
    cliente = Client(account_id=conta.id, name="Cliente Com Recebida")
    db.add(cliente)
    db.flush()
    projeto = Project(
        account_id=conta.id,
        client_id=cliente.id,
        name="Projeto Com Recebida",
        payment_method="CUSTOM",
        payment_installments=3,
        service_value=900.0,
    )
    db.add(projeto)
    db.flush()
    db.add(
        FinancialEntry(
            account_id=conta.id,
            project_id=projeto.id,
            description="Parcela 1/3 - Projeto Com Recebida",
            amount=300.0,
            type="INCOME",
            status="REALIZED",
            due_date=date(2026, 9, 1),
        )
    )
    db.add(
        FinancialEntry(
            account_id=conta.id,
            project_id=projeto.id,
            description="Parcela 2/3 - Projeto Com Recebida",
            amount=300.0,
            type="INCOME",
            status="PREDICTED",
            due_date=date(2026, 10, 1),
        )
    )
    db.add(
        FinancialEntry(
            account_id=conta.id,
            project_id=projeto.id,
            description="Parcela 3/3 - Projeto Com Recebida",
            amount=300.0,
            type="INCOME",
            status="PREDICTED",
            due_date=date(2026, 11, 1),
        )
    )
    db.flush()
    return projeto


def test_detalhe_com_parcela_recebida_devolve_o_cronograma_inteiro(
    db: Session, client_a, conta_a
):
    """Achado 1: a consulta do detalhe filtrava so status == "PREDICTED",
    enquanto `project.payment_installments` conta todas as parcelas. Projeto
    com 3 parcelas e uma ja recebida devolvia so 2 em `custom_installments`,
    e o ProjectWizard reconstruia o cronograma para 3 linhas (a terceira sem
    data), reprovando no superRefine. O detalhe agora devolve as 3."""
    conta, _ = conta_a
    projeto = _projeto_custom_com_parcela_recebida(db, conta)

    corpo = client_a.get(f"/api/projects/{projeto.id}").json()

    assert corpo["payment_method"] == "CUSTOM"
    assert len(corpo["custom_installments"]) == 3
    datas = {p["due_date"] for p in corpo["custom_installments"]}
    assert datas == {"2026-09-01", "2026-10-01", "2026-11-01"}


def test_editar_projeto_personalizado_com_parcela_recebida_nao_duplica_lancamento(
    db: Session, client_a, conta_a
):
    """Achado 1 (adjacente): salvar (PUT) o cronograma que o detalhe devolveu
    - recebida incluida - nao pode recriar a parcela ja recebida. Antes desta
    correcao, `sync_project_financials` criava `len(custom_installments)`
    entradas PREDICTED novas sem olhar para o que ja foi recebido: o projeto
    passava a ter as recebidas MAIS as novas (900 -> 1200 em receita)."""
    conta, _ = conta_a
    projeto = _projeto_custom_com_parcela_recebida(db, conta)

    detalhe = client_a.get(f"/api/projects/{projeto.id}").json()
    antes = (
        db.query(FinancialEntry)
        .filter(FinancialEntry.project_id == projeto.id, FinancialEntry.type == "INCOME")
        .count()
    )
    assert antes == 3

    r = client_a.put(
        f"/api/projects/{projeto.id}",
        json={"custom_installments": detalhe["custom_installments"]},
    )
    assert r.status_code == 200, r.text

    db.expunge_all()
    entradas = (
        db.query(FinancialEntry)
        .filter(FinancialEntry.project_id == projeto.id, FinancialEntry.type == "INCOME")
        .order_by(FinancialEntry.due_date.asc())
        .all()
    )
    assert len(entradas) == 3, [
        (e.status, e.amount, e.due_date) for e in entradas
    ]
    recebida = entradas[0]
    assert recebida.status == "REALIZED"
    assert recebida.amount == 300.0
    assert recebida.due_date == date(2026, 9, 1)
    assert {e.status for e in entradas[1:]} == {"PREDICTED"}

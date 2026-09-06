"""
Orcamento: contrato e isolamento.

Os 10 testes de tests/isolation/test_budgets_isolation.py, vindos da Secao 1,
continuam valendo e nao sao repetidos aqui. Estes cobrem o que a conversao
muda: created_by, e o caminho de item que antes passava por
`buscar_item_da_conta`.

Nao existe rota `GET /api/budgets/{budget_id}` (so
`GET /api/projects/{project_id}/budget` e `GET /api/budgets/{id}/summary`,
que tem outro formato de resposta) — os dois testes abaixo que precisam do
orcamento inteiro usam a rota por projeto.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Budget, BudgetItem, Environment, Product, RuleType
from tests.conftest import criar_projeto


def _orcamento_com_item(db: Session, conta):
    projeto = criar_projeto(db, conta, "Projeto")
    ambiente = Environment(account_id=conta.id, project_id=projeto.id, name="Sala")
    orcamento = Budget(account_id=conta.id, project_id=projeto.id)
    db.add_all([ambiente, orcamento])
    db.flush()
    item = BudgetItem(
        account_id=conta.id,
        budget_id=orcamento.id,
        environment_id=ambiente.id,
        rule_type=RuleType.FLOOR,
    )
    db.add(item)
    db.flush()
    return orcamento, item


def test_item_de_orcamento_alheio_e_404(db: Session, client_a, conta_b):
    _, item = _orcamento_com_item(db, conta_b[0])

    r = client_a.patch(
        f"/api/budgets/items/{item.id}", json={"manual_quantity": 99}
    )

    assert r.status_code == 404
    db.refresh(item)
    assert item.manual_quantity is None


def test_orcamento_alheio_e_404(db: Session, client_a, conta_b):
    orcamento, _ = _orcamento_com_item(db, conta_b[0])

    assert (
        client_a.get(f"/api/projects/{orcamento.project_id}/budget").status_code
        == 404
    )


def test_criar_item_grava_conta_e_autor(db: Session, client_a, conta_a):
    """
    A rota real e `POST /api/budgets/items`, com `project_id`, `environment_id`
    e `product_id` no corpo — nao `POST /api/budgets/{id}/items` como o brief
    original supunha; essa rota nao existe (verificado com
    `grep "@router\\." app/api/routers/budgets_router.py`).
    """
    projeto = criar_projeto(db, conta_a[0], "Projeto do item")
    ambiente = Environment(
        account_id=conta_a[0].id, project_id=projeto.id, name="Sala"
    )
    produto = Product(account_id=conta_a[0].id, name="Piso", price=10.0)
    db.add_all([ambiente, produto])
    db.flush()

    r = client_a.post(
        "/api/budgets/items",
        json={
            "project_id": str(projeto.id),
            "environment_id": str(ambiente.id),
            "product_id": str(produto.id),
            "rule_type": "FLOOR",
        },
    )

    assert r.status_code in (200, 201)
    criado = (
        db.query(BudgetItem)
        .filter(BudgetItem.environment_id == ambiente.id)
        .order_by(BudgetItem.id.desc())
        .first()
    )
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id


def test_o_total_do_orcamento_continua_o_mesmo_contrato(db: Session, client_a, conta_a):
    """
    A Tarefa 8 trocou o motor de calculo. O corpo da resposta nao muda: a
    Secao 5 depende deste formato.
    """
    orcamento, _ = _orcamento_com_item(db, conta_a[0])

    corpo = client_a.get(f"/api/projects/{orcamento.project_id}/budget").json()

    assert "total_value" in corpo
    assert "items" in corpo
    for item in corpo["items"]:
        assert "calculated_quantity" in item
        assert "base_area" in item
        assert "has_yield_alert" in item

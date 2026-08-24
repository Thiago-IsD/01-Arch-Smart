"""
Regressao dos IDORs de orcamento (auditoria 23/08/2026, achado P0-1).

Cada teste monta um orcamento na conta A e tenta alcanca-lo autenticado
como conta B. A resposta correta e 404 — nunca 200.
"""
import uuid

import pytest

from app.models.all_models import (
    Budget,
    BudgetItem,
    ItemOption,
    Product,
    RuleType,
)

from tests.conftest import criar_projeto


@pytest.fixture
def item_da_conta_a(db, conta_a):
    conta, _ = conta_a
    projeto = criar_projeto(db, conta, "Projeto A")

    orcamento = Budget(project_id=projeto.id, total_value=0.0)
    db.add(orcamento)
    db.flush()

    item = BudgetItem(
        budget_id=orcamento.id,
        rule_type=RuleType.UNIT,
        manual_quantity=1,
    )
    db.add(item)
    db.flush()
    return item


def test_conta_b_nao_altera_item_da_conta_a(client_b, item_da_conta_a):
    resposta = client_b.patch(
        f"/api/budgets/items/{item_da_conta_a.id}",
        json={"manual_quantity": 999},
    )
    assert resposta.status_code == 404


def test_conta_b_nao_apaga_item_da_conta_a(client_b, item_da_conta_a):
    resposta = client_b.delete(f"/api/budgets/items/{item_da_conta_a.id}")
    assert resposta.status_code == 404


def test_conta_b_nao_adiciona_opcao_em_item_da_conta_a(client_b, item_da_conta_a):
    resposta = client_b.post(
        f"/api/budgets/items/{item_da_conta_a.id}/options",
        json={"product_id": str(uuid.uuid4())},
    )
    assert resposta.status_code == 404


def test_conta_a_altera_o_proprio_item(client_a, item_da_conta_a):
    resposta = client_a.patch(
        f"/api/budgets/items/{item_da_conta_a.id}",
        json={"manual_quantity": 7},
    )
    assert resposta.status_code == 200
    assert resposta.json()["manual_quantity"] == 7


@pytest.fixture
def opcao_da_conta_a(db, conta_a, item_da_conta_a):
    conta, _ = conta_a
    produto = Product(account_id=conta.id, name="Piso Vinilico", price=120.0)
    db.add(produto)
    db.flush()

    opcao = ItemOption(
        budget_item_id=item_da_conta_a.id,
        product_id=produto.id,
        is_selected=True,
    )
    db.add(opcao)
    db.flush()
    return opcao


def test_conta_b_nao_seleciona_opcao_da_conta_a(client_b, opcao_da_conta_a):
    resposta = client_b.patch(f"/api/budgets/options/{opcao_da_conta_a.id}/select")
    assert resposta.status_code == 404


def test_conta_b_nao_apaga_opcao_da_conta_a(client_b, opcao_da_conta_a):
    resposta = client_b.delete(f"/api/budgets/options/{opcao_da_conta_a.id}")
    assert resposta.status_code == 404


def test_conta_b_nao_le_resumo_de_orcamento_da_conta_a(client_b, db, item_da_conta_a):
    resposta = client_b.get(f"/api/budgets/{item_da_conta_a.budget_id}/summary")
    assert resposta.status_code == 404


def test_conta_a_le_o_proprio_resumo(client_a, item_da_conta_a):
    resposta = client_a.get(f"/api/budgets/{item_da_conta_a.budget_id}/summary")
    assert resposta.status_code == 200

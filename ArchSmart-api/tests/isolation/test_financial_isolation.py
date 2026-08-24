"""
Regressao do CRITICAL 2 da revisao final da Secao 1: financial.py aceitava
project_id do corpo sem checar se o projeto pertence a conta do usuario
autenticado -- a mesma classe de falha que a Task 2 fechou para product_id.

Cada teste prova que a conta B nao consegue gravar nem enxergar dados do
projeto da conta A atraves de financial.py.
"""
from datetime import date

import pytest

from tests.conftest import criar_projeto


@pytest.fixture
def projeto_da_conta_a(db, conta_a):
    conta, _ = conta_a
    return criar_projeto(db, conta, "Projeto Financeiro A")


def test_conta_b_nao_cria_lancamento_apontando_para_projeto_da_conta_a(
    client_b, projeto_da_conta_a
):
    resposta = client_b.post(
        "/api/financial",
        json={
            "project_id": str(projeto_da_conta_a.id),
            "type": "INCOME",
            "status": "PREDICTED",
            "amount": 1000.0,
            "due_date": str(date.today()),
            "description": "Tentativa de vincular projeto alheio",
            "category": "Outros",
            "recurrence": "UNIQUE",
        },
    )
    assert resposta.status_code == 404
    assert "projeto" in resposta.json()["detail"].lower()


def test_conta_b_nao_ve_nome_de_projeto_da_conta_a_na_listagem(
    client_b, db, conta_b, projeto_da_conta_a
):
    """
    Antes da correcao, um lancamento sem account_id do projeto real (por
    exemplo, um registro legado ou criado antes do fix) conseguia mostrar o
    nome do projeto de outra conta via outerjoin sem filtro de account_id.
    Este teste crava a propriedade: mesmo que exista um FinancialEntry cujo
    project_id aponte para um projeto de outra conta, o nome nunca vaza.
    """
    from app.models.all_models import FinancialEntry

    conta, _ = conta_b
    hoje = date.today()
    lancamento = FinancialEntry(
        account_id=conta.id,
        project_id=projeto_da_conta_a.id,  # projeto de OUTRA conta
        type="EXPENSE",
        status="PREDICTED",
        amount=50.0,
        due_date=hoje,
        description="Lancamento da conta B com project_id vazado",
        category="Outros",
    )
    db.add(lancamento)
    db.flush()

    resposta = client_b.get(
        "/api/financial", params={"month": hoje.month, "year": hoje.year}
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert len(corpo) == 1
    assert corpo[0]["project_name"] is None, (
        "o nome do projeto da conta A vazou na listagem da conta B"
    )


def test_conta_a_cria_lancamento_no_proprio_projeto(client_a, projeto_da_conta_a):
    resposta = client_a.post(
        "/api/financial",
        json={
            "project_id": str(projeto_da_conta_a.id),
            "type": "INCOME",
            "status": "PREDICTED",
            "amount": 1000.0,
            "due_date": str(date.today()),
            "description": "Lancamento legitimo",
            "category": "Outros",
            "recurrence": "UNIQUE",
        },
    )
    assert resposta.status_code == 200
    assert resposta.json()["project_id"] == str(projeto_da_conta_a.id)

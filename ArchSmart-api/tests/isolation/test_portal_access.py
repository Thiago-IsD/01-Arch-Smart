"""
Regressao do achado P0-2: as acoes do portal nao verificavam o token.

O GET da apresentacao exige senha; aprovar, rejeitar, selecionar, aceitar e
ler comentarios nao exigiam nada. Quem tivesse o UUID aceitava um orcamento.
"""
import pytest

from app.core.portal_security import create_portal_token, hash_password
from app.models.all_models import (
    Budget,
    BudgetItem,
    ItemOption,
    Presentation,
    Product,
    RuleType,
)

from tests.conftest import criar_projeto


@pytest.fixture
def apresentacao_com_senha(db, conta_a):
    conta, _ = conta_a
    projeto = criar_projeto(db, conta, "Projeto Portal")

    apresentacao = Presentation(
        project_id=projeto.id,
        name="Proposta Sala de Estar",
        access_password_hash=hash_password("senha-do-cliente"),
    )
    db.add(apresentacao)
    db.flush()

    orcamento = Budget(project_id=projeto.id, total_value=0.0)
    db.add(orcamento)
    db.flush()
    item = BudgetItem(budget_id=orcamento.id, rule_type=RuleType.UNIT, manual_quantity=1)
    db.add(item)
    db.flush()
    produto = Product(account_id=conta.id, name="Luminaria", price=300.0)
    db.add(produto)
    db.flush()
    opcao = ItemOption(budget_item_id=item.id, product_id=produto.id, is_selected=False)
    db.add(opcao)
    db.flush()

    return apresentacao, opcao


ACOES_SEM_CORPO = ["select", "approve", "reject"]


@pytest.mark.parametrize("acao", ACOES_SEM_CORPO)
def test_acao_no_portal_sem_token_e_recusada(client_anon, apresentacao_com_senha, acao):
    apresentacao, opcao = apresentacao_com_senha
    resposta = client_anon.post(
        f"/public/presentations/{apresentacao.id}/options/{opcao.id}/{acao}"
    )
    assert resposta.status_code == 401


def test_comentarios_sem_token_sao_recusados(client_anon, apresentacao_com_senha):
    apresentacao, _ = apresentacao_com_senha
    resposta = client_anon.get(f"/public/presentations/{apresentacao.id}/comments")
    assert resposta.status_code == 401


@pytest.mark.parametrize("acao", ACOES_SEM_CORPO)
def test_acao_no_portal_com_token_valido_e_aceita(client_anon, apresentacao_com_senha, acao):
    apresentacao, opcao = apresentacao_com_senha
    token = create_portal_token(str(apresentacao.id))
    resposta = client_anon.post(
        f"/public/presentations/{apresentacao.id}/options/{opcao.id}/{acao}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resposta.status_code == 200


def test_token_de_outra_apresentacao_nao_serve(client_anon, apresentacao_com_senha):
    apresentacao, opcao = apresentacao_com_senha
    token_alheio = create_portal_token("00000000-0000-0000-0000-000000000000")
    resposta = client_anon.post(
        f"/public/presentations/{apresentacao.id}/options/{opcao.id}/approve",
        headers={"Authorization": f"Bearer {token_alheio}"},
    )
    assert resposta.status_code == 401

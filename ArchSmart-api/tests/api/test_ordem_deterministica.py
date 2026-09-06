"""
Duas leituras sem ORDER BY, e o que elas custavam.

Postgres devolve linha na ordem que quiser quando ninguem pede ordem. Isso
nao e "aleatorio de vez em quando": e um contrato que nao existe, e duas
consultas equivalentes podem devolver ordens diferentes por motivo nenhum —
um `VACUUM`, um plano diferente, uma linha atualizada.

Os dois casos aqui nao sao o mesmo defeito:

- `GET /api/users/me` lia a assinatura com `.first()` sem ordem, enquanto
  `entitlements_da_conta` (que a MESMA resposta chama) lia com
  `order_by(Subscription.id)`. Sem unique constraint em
  `subscriptions.account_id`, uma conta com duas assinaturas podia receber
  `subscription_status`/`plan_name` de UMA linha e `entitlements` de OUTRA,
  na mesma resposta. O cliente nao tem como notar.
- `GET /projects/{id}/budget` montava `Budget.items` a partir de uma query
  sem ordem, entao a ordem dos itens no front podia mudar entre duas
  leituras do mesmo orcamento, sem nada ter mudado.
"""
import uuid

from sqlalchemy.orm import Session

from app.models.all_models import (
    Account,
    Budget,
    BudgetItem,
    Environment,
    Plan,
    RuleType,
    Subscription,
    SubscriptionStatus,
)
from tests.conftest import criar_projeto


def _assinatura(db: Session, conta: Account, nome_do_plano: str, limite: int):
    plano = Plan(name=nome_do_plano, limits={"project_limit": limite})
    db.add(plano)
    db.flush()
    assinatura = Subscription(
        account_id=conta.id, plan_id=plano.id, status=SubscriptionStatus.ACTIVE
    )
    db.add(assinatura)
    db.flush()
    return assinatura


def test_me_concorda_com_os_entitlements_da_mesma_resposta(db, client_a, conta_a):
    """
    Duas assinaturas na MESMA conta, com planos de limites diferentes. Sem
    ordenacao combinada entre as duas leituras, `plan_name` e
    `entitlements.project_limit` podem sair de assinaturas diferentes. Nao ha
    unique constraint em `subscriptions.account_id` que impeca este estado —
    conferido no schema, nao suposto.
    """
    conta = conta_a[0]
    a = _assinatura(db, conta, "Plano de 7", 7)
    b = _assinatura(db, conta, "Plano de 99", 99)
    # Qual das duas vence e o que `order_by(Subscription.id)` decide; o teste
    # nao afirma QUAL, so que as duas leituras decidem IGUAL.
    primeira = a if str(a.id) < str(b.id) else b
    esperado = {a.id: ("Plano de 7", 7), b.id: ("Plano de 99", 99)}[primeira.id]

    resposta = client_a.get("/api/users/me")

    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert corpo["account"]["plan_name"] == esperado[0], (
        "plan_name veio de uma assinatura, entitlements de outra — as duas "
        "leituras precisam da MESMA ordenacao."
    )
    assert corpo["entitlements"]["project_limit"] == esperado[1], (
        "entitlements veio de uma assinatura, plan_name de outra."
    )


def test_itens_do_orcamento_saem_sempre_na_mesma_ordem(db, client_a, conta_a):
    """
    Nao afirma QUAL ordem — `BudgetItem.id` e UUID4, a ordem nao significa
    nada. Afirma que ela e a MESMA em duas leituras, e que e a ordem que o
    ORDER BY pede: `sorted(por id)`. Sem ORDER BY, este segundo assert e o
    que nao tem garantia nenhuma.
    """
    conta, usuario = conta_a
    projeto = criar_projeto(db, conta, "Projeto do orcamento", usuario)
    orcamento = Budget(account_id=conta.id, project_id=projeto.id)
    db.add(orcamento)
    db.flush()
    for indice in range(8):
        ambiente = Environment(
            account_id=conta.id, project_id=projeto.id, name=f"Ambiente {indice}"
        )
        db.add(ambiente)
        db.flush()
        db.add(
            BudgetItem(
                account_id=conta.id,
                budget_id=orcamento.id,
                environment_id=ambiente.id,
                rule_type=RuleType.FLOOR,
            )
        )
    db.flush()

    primeira = client_a.get(f"/api/projects/{projeto.id}/budget")
    segunda = client_a.get(f"/api/projects/{projeto.id}/budget")

    assert primeira.status_code == 200, primeira.text
    ids_1 = [item["id"] for item in primeira.json()["items"]]
    ids_2 = [item["id"] for item in segunda.json()["items"]]

    assert len(ids_1) == 8
    assert ids_1 == ids_2, "duas leituras do mesmo orcamento, ordens diferentes"
    assert ids_1 == sorted(ids_1, key=uuid.UUID), (
        "a ordem nao e a do ORDER BY: alguem tirou o order_by(BudgetItem.id) "
        "de carregar_orcamento, e o que sobrou foi a ordem arbitraria do "
        "Postgres — que hoje coincide, e amanha nao."
    )

"""
Entitlements da conta — o que o plano dela permite.

Art. 3: limite de plano e decisao do servidor. O front renderiza o que a API
devolver e nunca fixa um numero. Enquanto o front tiver o
`data?.plan_limit ?? 2` que ainda existe em `dashboard/page.tsx` e
`projects/page.tsx`, a violacao continua registrada — a correcao dela e da
Secao 5, mas a fonte de verdade nasce aqui.

`Plan.limits` e uma coluna JSON livre. Os defaults (`PADRAO`) valem quando a
conta nao tem nenhuma assinatura, quando `limits` e SQL NULL, quando o JSON
nao traz a chave perguntada, ou quando a assinatura esta CANCELED — os
quatro casos alcancaveis hoje. `Subscription.plan_id` e `nullable=False` com
FK para `plans.id` (`app/models/all_models.py`); assinatura sem plano ou
apontando para um plano apagado nao e um estado que o schema permite, entao
nao esta na lista acima — medido, nao suposto.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.all_models import Plan, Subscription, SubscriptionStatus

PADRAO: dict[str, Any] = {
    "project_limit": 2,
    "can_use_ai": True,
    "can_use_portal": True,
}


def entitlements_da_conta(db: Session, account_id: UUID) -> dict[str, Any]:
    """
    Uma query, com outer join para o plano. O outerjoin e defesa redundante,
    nao resposta a um estado que o schema permita: `Subscription.plan_id` e
    `nullable=False` com FK para `plans.id`, entao nem `plan_id` nulo nem
    apontando para um plano apagado sao alcancaveis hoje — se um dia deixarem
    de ser, o outerjoin evita um crash em vez de propagar o problema para
    toda requisicao autenticada. Os estados sem limite do plano que SAO
    alcancaveis: conta sem nenhuma linha em `subscriptions`, `Plan.limits`
    como SQL NULL, `limits` que nao e um objeto, e assinatura CANCELED.

    CANCELED nao concede os limites do plano — a conta cai no `PADRAO`.
    BETA, ACTIVE e READ_ONLY concedem: READ_ONLY e um eixo de permissao de
    escrita (a conta so le, nao grava), nao um eixo de cota, e nao deve ser
    tratado como "sem direito a limite" so porque os dois eixos parecem a
    mesma coisa — alguem vai tentar "corrigir" isso de novo, daí o comentario.

    `order_by(Subscription.id)` existe so para tornar o `.first()`
    deterministico: nao ha unique constraint em `subscriptions.account_id`,
    entao mais de uma linha para a mesma conta faria o Postgres devolver uma
    linha arbitraria sem uma ordenacao explicita.
    """
    linha = (
        db.query(Subscription.status, Plan.limits)
        .select_from(Subscription)
        .outerjoin(Plan, Plan.id == Subscription.plan_id)
        .filter(Subscription.account_id == account_id)
        .order_by(Subscription.id)
        .first()
    )
    if linha is None:
        return dict(PADRAO)

    status, limits = linha
    if status == SubscriptionStatus.CANCELED:
        return dict(PADRAO)

    limites = limits or {}
    if not isinstance(limites, dict):
        # Plan.limits e JSON livre; uma lista ou string ali nao pode derrubar
        # toda requisicao autenticada.
        limites = {}
    return {**PADRAO, **limites}

"""
Entitlements da conta — o que o plano dela permite.

Art. 3: limite de plano e decisao do servidor. O front renderiza o que a API
devolver e nunca fixa um numero. Enquanto o front tiver o
`data?.plan_limit ?? 2` que ainda existe em `dashboard/page.tsx` e
`projects/page.tsx`, a violacao continua registrada — a correcao dela e da
Secao 5, mas a fonte de verdade nasce aqui.

`Plan.limits` e uma coluna JSON livre. Os defaults (`PADRAO`) valem quando a
conta nao tem assinatura, quando a assinatura nao tem plano, quando o JSON
nao traz a chave, ou quando a assinatura esta CANCELED — os quatro casos
existem hoje no banco ou sao alcancaveis pela maquina de estados de
`SubscriptionStatus`.
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
    Uma query, com outer join para o plano: conta sem assinatura nao vira
    None no meio do caminho, vira os defaults.

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

"""
Entitlements da conta — o que o plano dela permite.

Art. 3: limite de plano e decisao do servidor. O front renderiza o que a API
devolver e nunca fixa um numero. Enquanto o front tiver o
`data?.plan_limit ?? 2` que ainda existe em `dashboard/page.tsx` e
`projects/page.tsx`, a violacao continua registrada — a correcao dela e da
Secao 5, mas a fonte de verdade nasce aqui.

`Plan.limits` e uma coluna JSON livre. Os defaults abaixo valem quando a conta
nao tem assinatura, quando a assinatura nao tem plano, ou quando o JSON nao
traz a chave — os tres casos existem hoje no banco.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.all_models import Plan, Subscription

PADRAO: dict[str, Any] = {
    "project_limit": 2,
    "can_use_ai": True,
    "can_use_portal": True,
}


def entitlements_da_conta(db: Session, account_id: UUID) -> dict[str, Any]:
    """
    Uma query, com outer join para o plano: conta sem assinatura nao vira
    None no meio do caminho, vira os defaults.
    """
    linha = (
        db.query(Plan.limits)
        .select_from(Subscription)
        .outerjoin(Plan, Plan.id == Subscription.plan_id)
        .filter(Subscription.account_id == account_id)
        .first()
    )
    limites = (linha[0] if linha else None) or {}
    if not isinstance(limites, dict):
        # Plan.limits e JSON livre; uma lista ou string ali nao pode derrubar
        # toda requisicao autenticada.
        limites = {}
    return {**PADRAO, **limites}

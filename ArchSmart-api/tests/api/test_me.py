"""
GET /api/users/me devolve usuario, conta e entitlements.

Art. 3: limite de plano e decisao do servidor. Enquanto o front tiver
`data?.plan_limit ?? 2` (dashboard/page.tsx e projects/page.tsx), a violacao
continua registrada — mas a fonte de verdade passa a existir aqui, e a Secao 5
tem o que consumir.
"""
import uuid

from sqlalchemy.orm import Session

from app.models.all_models import Plan, Subscription
from app.services.entitlements import PADRAO


def test_me_devolve_usuario_conta_e_entitlements(client_a, conta_a):
    r = client_a.get("/api/users/me")

    assert r.status_code == 200
    corpo = r.json()
    assert corpo["id"] == str(conta_a[1].id)
    assert corpo["email"] == conta_a[1].email
    assert corpo["account"]["id"] == str(conta_a[0].id)
    assert "entitlements" in corpo


def test_conta_sem_assinatura_recebe_os_defaults(client_a):
    corpo = client_a.get("/api/users/me").json()

    assert corpo["entitlements"] == PADRAO


def test_limites_do_plano_sobrescrevem_os_defaults(db: Session, client_a, conta_a):
    plano = Plan(name="Estudio", limits={"project_limit": 25})
    db.add(plano)
    db.flush()
    db.add(
        Subscription(account_id=conta_a[0].id, plan_id=plano.id)
    )
    db.flush()

    corpo = client_a.get("/api/users/me").json()

    assert corpo["entitlements"]["project_limit"] == 25
    # As chaves que o plano nao menciona continuam vindo do padrao.
    assert corpo["entitlements"]["can_use_ai"] == PADRAO["can_use_ai"]


def test_plano_com_limits_invalido_nao_derruba_a_rota(db: Session, client_a, conta_a):
    """
    Plan.limits e JSON livre. Ja houve linha com lista ali. Uma resposta 500
    em /me derruba o app inteiro, porque toda tela chama esta rota.
    """
    plano = Plan(name="Quebrado", limits=["isto nao e um objeto"])
    db.add(plano)
    db.flush()
    db.add(Subscription(account_id=conta_a[0].id, plan_id=plano.id))
    db.flush()

    r = client_a.get("/api/users/me")

    assert r.status_code == 200
    assert r.json()["entitlements"] == PADRAO


def test_me_de_outra_conta_e_impossivel(client_a, conta_a, conta_b):
    """
    Nao ha parametro que escolha a conta. Tentar por query string nao muda
    nada — o escopo vem do token (Art. 1).
    """
    corpo = client_a.get(
        "/api/users/me", params={"account_id": str(conta_b[0].id)}
    ).json()

    assert corpo["account"]["id"] == str(conta_a[0].id)

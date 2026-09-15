"""
GET /api/users/me devolve usuario, conta e entitlements.

Art. 3: limite de plano e decisao do servidor. Enquanto o front tiver
`data?.plan_limit ?? 2` (dashboard/page.tsx e projects/page.tsx), a violacao
continua registrada — mas a fonte de verdade passa a existir aqui, e a Secao 5
tem o que consumir.
"""
import uuid

import pytest
from sqlalchemy.orm import Session

from app.core.errors import NotFound
from app.core.security import RequestContext
from app.db.repository import ScopedRepository
from app.models.all_models import Plan, Subscription
from app.services.entitlements import PADRAO
from tests.contador_de_queries import ContadorDeQueries, contexto_de_verdade


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


def test_me_gasta_no_maximo_tres_consultas_com_assinatura_e_plano(
    db: Session, client_a, conta_a, monkeypatch
):
    """
    Com assinatura E plano, que e o caso que mais consultava: usuario de novo,
    conta, assinatura, plano e entitlements recalculados. O teto e 3: o caminho
    compartilhado (1), a conta (1) e assinatura com plano num join (1).
    """
    conta, usuario = conta_a
    plano = Plan(name="Estudio", limits={"project_limit": 25})
    db.add(plano)
    db.flush()
    db.add(Subscription(account_id=conta.id, plan_id=plano.id))
    db.flush()

    with contexto_de_verdade(client_a, db, usuario, monkeypatch) as headers:
        with ContadorDeQueries(db.connection()) as contador:
            r = client_a.get("/api/users/me", headers=headers)

    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["account"]["plan_name"] == "Estudio"
    assert corpo["entitlements"]["project_limit"] == 25
    assert len(contador) <= 3, f"{len(contador)} consultas:\n  {contador.resumo()}"


def test_me_nao_devolve_usuario_de_outra_conta_pelo_atalho_da_sessao(
    db: Session, conta_a, conta_b
):
    """
    `repo.usuario()` le da identity map, e a identity map nao sabe de conta.
    A guarda de `account_id` dentro do metodo e o que impede um contexto
    inconsistente de devolver o usuario errado.

    `usuario_b` ja esta na identity map so por a fixture `conta_b` segurar a
    referencia na variavel local — nao precisa de um `db.get()` extra para
    garantir isso.
    """
    _, usuario_b = conta_b
    ctx = RequestContext(
        user_id=usuario_b.id,
        account_id=conta_a[0].id,  # conta errada de proposito
        email=usuario_b.email,
        entitlements={},
    )

    with pytest.raises(NotFound):
        ScopedRepository(db, ctx).usuario()


def test_me_usuario_inexistente_levanta_notfound(db: Session, conta_a):
    """
    Ramo `achado is None` de `repo.usuario()`: um `user_id` que nao existe em
    lugar nenhum (nao so em outra conta) tambem tem que dar 404, nao um erro
    de atributo em cima de `None`.
    """
    conta, _ = conta_a
    ctx = RequestContext(
        user_id=uuid.uuid4(),  # nao existe nenhum User com este id
        account_id=conta.id,
        email="ninguem@teste.local",
        entitlements={},
    )

    with pytest.raises(NotFound):
        ScopedRepository(db, ctx).usuario()

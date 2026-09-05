"""
Identidade da requisicao: o que o servidor resolve e o que ele ignora.

Os dois primeiros testes sao a regressao da pendencia de seguranca registrada
em docs/dev/arquitetura.md — o auto-link por e-mail e o auto-create. Eles
falham enquanto app/api/users.py resolver identidade por e-mail.
"""
import dataclasses
import uuid

import pytest
from sqlalchemy.orm import Session

from app.api.users import get_current_user
from app.core.security import RequestContext, get_context, resolve_identity_por_claims
from app.main import app
from app.models.all_models import Account, Plan, Subscription, SubscriptionStatus, User
from app.services.auth_service import auth_service
from app.services.entitlements import PADRAO, entitlements_da_conta


def _usuario(db: Session, email: str, supabase_id: str) -> User:
    conta = Account(name=f"Conta de {email}")
    db.add(conta)
    db.flush()
    usuario = User(
        account_id=conta.id,
        email=email,
        full_name="Fulano",
        supabase_id=supabase_id,
    )
    db.add(usuario)
    db.flush()
    return usuario


def test_nao_vincula_conta_alheia_por_email(db: Session):
    """
    Um token cujo `sub` nao esta em nenhuma linha NAO pode ser vinculado a um
    usuario existente so porque o e-mail bate. Era o auto-link.
    """
    vitima = _usuario(db, "vitima@teste.local", str(uuid.uuid4()))
    supabase_id_do_atacante = str(uuid.uuid4())

    with pytest.raises(LookupError):
        resolve_identity_por_claims(
            db, supabase_id=supabase_id_do_atacante, email="vitima@teste.local"
        )

    db.refresh(vitima)
    assert vitima.supabase_id != supabase_id_do_atacante


def test_nao_cria_conta_sozinho(db: Session):
    """
    Token de alguem que nao existe no banco nao provisiona conta nova. O
    provisionamento tem rota propria: POST /api/auth/signup.
    """
    contas_antes = db.query(Account).count()

    with pytest.raises(LookupError):
        resolve_identity_por_claims(
            db, supabase_id=str(uuid.uuid4()), email="novo@teste.local"
        )

    assert db.query(Account).count() == contas_antes


def test_resolve_por_supabase_id(db: Session):
    supabase_id = str(uuid.uuid4())
    usuario = _usuario(db, "certo@teste.local", supabase_id)

    achado = resolve_identity_por_claims(db, supabase_id=supabase_id, email=None)

    assert achado.id == usuario.id
    assert achado.account_id == usuario.account_id


def test_contexto_ignora_account_id_do_cliente(client_a, conta_a):
    """
    Art. 1: o que vem do cliente e ignorado. Mandar account_id de outra conta
    no corpo nao muda o escopo da resposta.
    """
    resposta = client_a.get(
        "/api/users/me", params={"account_id": str(uuid.uuid4())}
    )
    assert resposta.status_code == 200
    assert resposta.json()["account"]["id"] == str(conta_a[0].id)


def test_contexto_e_imutavel():
    ctx = RequestContext(
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        email="a@b.local",
        entitlements={},
    )
    # FrozenInstanceError, nao Exception: com `Exception` este teste passaria
    # ate por um TypeError de construtor, sem provar que o objeto e imutavel.
    with pytest.raises(dataclasses.FrozenInstanceError):
        ctx.account_id = uuid.uuid4()


def test_get_context_devolve_401_para_token_que_nao_resolve(
    client_a, conta_a, monkeypatch
):
    """
    O headline da Tarefa 2, exercitado pelo `get_context` de verdade — nao
    pela sobreposicao de dependencia que os outros testes usam. Toda fixture
    de cliente sobrepoe `get_current_user` (e `get_context`, que nem chega a
    ser resolvido pelo FastAPI porque `get_current_user` o chama direto no
    corpo), entao nenhum teste ate aqui provava o 401 de um token que nao
    aponta para ninguem passando pelo caminho de verdade.

    `SUPABASE_JWT_SECRET` e forcado a None para a validacao local falhar sem
    rede. A validacao remota e stubada para TER SUCESSO — e essa e a parte
    que importa: ela devolve um `sub` que nao esta em nenhuma linha, com o
    e-mail da vitima (`conta_a`) no payload, exatamente como um token de
    verdade emitido pelo Supabase para um atacante que conhece aquele
    e-mail. Isso forca a execucao a passar pelo `resolve_identity_por_claims`
    de verdade (security.py:99, a linha que a Tarefa 2 corrigiu) e cair no
    ramo `IdentidadeNaoResolvida` (security.py:143) — nao no ramo generico de
    "validacao falhou". Um stub que so faz a validacao remota FALHAR (como
    esta versao tinha antes da revisao) prova 401 pelo ramo errado: o token
    nunca chega a ser procurado no banco, e restaurar o auto-link por e-mail
    dentro de `resolve_identity_por_claims` deixaria este teste verde do
    mesmo jeito.
    """
    monkeypatch.setattr(
        "app.core.security.settings.SUPABASE_JWT_SECRET", None
    )

    async def _resolve_para_ninguem(token):
        # Validacao remota OK: o token e legitimo aos olhos do Supabase. O
        # `sub` e que nao esta em nenhuma linha — e o e-mail e o da vitima,
        # que era exatamente o que o auto-link usava para entregar a conta.
        return {"id": str(uuid.uuid4()), "email": conta_a[1].email}

    monkeypatch.setattr(auth_service, "get_user", _resolve_para_ninguem)

    sobrepostos = {}
    for dependencia in (get_context, get_current_user):
        if dependencia in app.dependency_overrides:
            sobrepostos[dependencia] = app.dependency_overrides.pop(dependencia)

    try:
        resposta = client_a.get(
            "/api/users/me",
            headers={"Authorization": "Bearer token-que-nao-existe-em-lugar-nenhum"},
        )
    finally:
        app.dependency_overrides.update(sobrepostos)

    assert resposta.status_code == 401
    corpo = resposta.text
    assert str(conta_a[0].id) not in corpo
    assert str(conta_a[1].id) not in corpo
    assert conta_a[1].email not in corpo


def _assinatura(
    db: Session, conta: Account, status: SubscriptionStatus, limits
) -> Subscription:
    plano = Plan(name="Plano de teste", limits=limits)
    db.add(plano)
    db.flush()
    assinatura = Subscription(account_id=conta.id, plan_id=plano.id, status=status)
    db.add(assinatura)
    db.flush()
    return assinatura


def test_entitlements_sem_assinatura_usa_padrao(db: Session):
    conta = Account(name="Conta sem assinatura")
    db.add(conta)
    db.flush()

    assert entitlements_da_conta(db, conta.id) == PADRAO


def test_entitlements_usa_limites_do_plano_por_cima_do_padrao(db: Session):
    conta = Account(name="Conta com plano")
    db.add(conta)
    db.flush()
    _assinatura(db, conta, SubscriptionStatus.ACTIVE, {"project_limit": 25})

    resultado = entitlements_da_conta(db, conta.id)

    assert resultado["project_limit"] == 25
    assert resultado["can_use_ai"] == PADRAO["can_use_ai"]
    assert resultado["can_use_portal"] == PADRAO["can_use_portal"]


def test_entitlements_limits_que_nao_e_objeto_cai_no_padrao(db: Session):
    conta = Account(name="Conta com limits invalido")
    db.add(conta)
    db.flush()
    _assinatura(db, conta, SubscriptionStatus.ACTIVE, ["nao e um objeto"])

    assert entitlements_da_conta(db, conta.id) == PADRAO


def test_entitlements_assinatura_cancelada_nao_concede_limites_do_plano(db: Session):
    """
    CANCELED nao herda os limites do plano, mesmo que o plano exista e tenha
    limites generosos: a conta cai no PADRAO (Important 4 da revisao).
    """
    conta = Account(name="Conta cancelada")
    db.add(conta)
    db.flush()
    _assinatura(db, conta, SubscriptionStatus.CANCELED, {"project_limit": 25})

    resultado = entitlements_da_conta(db, conta.id)

    assert resultado == PADRAO
    assert resultado["project_limit"] == 2

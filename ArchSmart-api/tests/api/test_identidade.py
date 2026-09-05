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

from app.core.security import RequestContext, resolve_identity_por_claims
from app.models.all_models import Account, User


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

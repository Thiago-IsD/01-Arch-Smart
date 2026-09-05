"""
O repositorio filtra por conta sozinho — e recusa o que nao consegue filtrar.

Cada teste aqui corresponde a uma forma de esquecer o filtro que ja aconteceu
neste codigo. A Secao 1 corrigiu 13 endpoints; esta classe existe para que a
14a vez nao seja possivel de escrever.
"""
import uuid

import pytest
from sqlalchemy.orm import Session

from app.core.errors import NotFound
from app.core.security import RequestContext
from app.db.repository import EscopoImpossivel, ScopedRepository
from app.models.all_models import Account, Client, Plan, Project, User


def _contexto(conta: Account, usuario: User) -> RequestContext:
    return RequestContext(
        user_id=usuario.id,
        account_id=conta.id,
        email=usuario.email,
        entitlements={},
    )


@pytest.fixture
def repo_a(db: Session, conta_a) -> ScopedRepository:
    return ScopedRepository(db, _contexto(*conta_a))


def _projeto(db: Session, conta: Account, nome: str) -> Project:
    cliente = Client(account_id=conta.id, name=f"Cliente de {nome}")
    db.add(cliente)
    db.flush()
    projeto = Project(account_id=conta.id, client_id=cliente.id, name=nome)
    db.add(projeto)
    db.flush()
    return projeto


def test_query_nao_devolve_linha_de_outra_conta(db, repo_a, conta_a, conta_b):
    _projeto(db, conta_a[0], "Meu")
    _projeto(db, conta_b[0], "Alheio")

    nomes = [p.name for p in repo_a.query(Project).all()]

    assert nomes == ["Meu"]


def test_get_de_recurso_alheio_devolve_none(db, repo_a, conta_b):
    alheio = _projeto(db, conta_b[0], "Alheio")

    assert repo_a.get(Project, alheio.id) is None


def test_obter_de_recurso_alheio_levanta_not_found(db, repo_a, conta_b):
    """
    NotFound, nao Forbidden: 403 confirmaria que o recurso existe.
    """
    alheio = _projeto(db, conta_b[0], "Alheio")

    with pytest.raises(NotFound):
        repo_a.obter(Project, alheio.id)


def test_obter_de_id_inexistente_levanta_not_found(repo_a):
    with pytest.raises(NotFound):
        repo_a.obter(Project, uuid.uuid4())


def test_model_sem_account_id_e_recusado(repo_a):
    """
    `Plan` e catalogo global. Nao da para filtrar por conta, e o repositorio
    prefere recusar a devolver tudo em silencio.
    """
    with pytest.raises(EscopoImpossivel) as erro:
        repo_a.query(Plan)

    assert "Art. 1" in str(erro.value)
    assert "unscoped_query" in str(erro.value)


def test_create_injeta_account_id_e_created_by(db, repo_a, conta_a):
    cliente = repo_a.create(Client, name="Cliente novo")
    db.flush()

    assert cliente.account_id == conta_a[0].id
    assert cliente.created_by == conta_a[1].id


def test_create_ignora_account_id_vindo_do_cliente(db, repo_a, conta_a, conta_b):
    """
    Art. 1: o que vem do cliente e ignorado. Passar account_id alheio nao
    move o recurso de conta — nem levanta erro que revele a outra conta.
    """
    cliente = repo_a.create(
        Client, name="Tentativa", account_id=conta_b[0].id
    )
    db.flush()

    assert cliente.account_id == conta_a[0].id


def test_create_ignora_relacionamento_account_vindo_do_cliente(
    db, repo_a, conta_a, conta_b
):
    """
    O SQLAlchemy escreve a FK de um relacionamento many-to-one no flush,
    DEPOIS do __init__ — entao passar `account=conta_alheia` (em vez do
    literal `account_id`) sobrescreve o account_id que create() acabou de
    injetar, silenciosamente. db.refresh() e obrigatorio: ler o atributo em
    memoria, sem recarregar do banco, e o que deixava isso escondido.
    """
    cliente = repo_a.create(Client, name="Tentativa", account=conta_b[0])
    db.flush()
    db.refresh(cliente)

    assert cliente.account_id == conta_a[0].id


def test_create_ignora_created_by_vindo_do_cliente(db, repo_a, conta_a, conta_b):
    """
    Como account_id, created_by vindo do chamador tambem e ignorado: o unico
    caminho ate essa coluna e o contexto (o usuario autenticado).
    """
    cliente = repo_a.create(
        Client, name="Tentativa", created_by=conta_b[1].id
    )
    db.flush()

    assert cliente.created_by == conta_a[1].id


def test_create_em_model_sem_account_id_levanta_escopo_impossivel(repo_a):
    with pytest.raises(EscopoImpossivel):
        repo_a.create(Plan, name="Novo Plano")


def test_remover_em_model_sem_account_id_levanta_escopo_impossivel(repo_a):
    """
    Erro de programacao (EscopoImpossivel), nao 404: nao ha conta nenhuma
    para comparar, entao NotFound aqui seria um 404 fingindo ser o caso
    normal de "recurso de outra conta".
    """
    plano = Plan(name="Catalogo")

    with pytest.raises(EscopoImpossivel):
        repo_a.remover(plano)


def test_remover_recusa_recurso_alheio(db, repo_a, conta_b):
    alheio = _projeto(db, conta_b[0], "Alheio")

    with pytest.raises(NotFound):
        repo_a.remover(alheio)

    assert db.query(Project).filter(Project.id == alheio.id).first() is not None


def test_unscoped_query_atravessa_o_escopo(db, conta_a, conta_b):
    """
    A escotilha funciona — e por isso ela tem um lint proprio
    (tests/test_arquitetura.py).
    """
    _projeto(db, conta_a[0], "Meu")
    _projeto(db, conta_b[0], "Alheio")

    assert ScopedRepository.unscoped_query(db, Project).count() == 2

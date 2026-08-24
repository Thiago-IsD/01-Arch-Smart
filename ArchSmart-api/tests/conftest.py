"""
Harness de teste contra Postgres real.

Por que não MagicMock: um mock devolve o mesmo objeto independentemente do
filtro aplicado, então nenhum teste sobre ele consegue provar isolamento
entre contas. Toda a Seção 1 existe porque essa classe de falha passou
despercebida por 83 testes.

Sobe com: docker compose -f docker-compose.test.yml up -d --wait
"""
import os
import uuid
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://arqsmart:arqsmart@localhost:55432/arqsmart_test",
)

_HOSTS_PROIBIDOS = ("supabase.co", "supabase.com", "rds.amazonaws.com")

if not TEST_DATABASE_URL.endswith("_test") or any(
    h in TEST_DATABASE_URL for h in _HOSTS_PROIBIDOS
):
    raise RuntimeError(
        "TEST_DATABASE_URL precisa apontar para um banco descartavel cujo nome "
        f"termina em '_test' e que nao seja gerenciado: {TEST_DATABASE_URL!r}. "
        "A suite apaga e recria o schema inteiro — apontar para producao destroi dados."
    )

# Sobrescreve INCONDICIONALMENTE. Nao use setdefault: se o ambiente (um runner
# de CI, por exemplo) ja exportar DATABASE_URL apontando para producao, o
# setdefault vira no-op e a suite roda contra o banco real — apagando o schema.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.db.base_class import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.all_models import Account, Client, Project, User  # noqa: E402
from app.api.users import get_current_user  # noqa: E402


def criar_projeto(db: Session, conta: Account, nome: str = "Projeto Teste") -> Project:
    """
    Cria um projeto valido para a conta.

    Project.client_id e NOT NULL com FK para clients, entao todo projeto
    exige um Client antes. Esquecer isso quebra a fixture com IntegrityError.
    """
    cliente = Client(account_id=conta.id, name=f"Cliente de {nome}")
    db.add(cliente)
    db.flush()
    projeto = Project(account_id=conta.id, client_id=cliente.id, name=nome)
    db.add(projeto)
    db.flush()
    return projeto


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    # Document.embedding e do tipo vector(1536) (pgvector). Sem a extensao, o
    # create_all falha com 'type "vector" does not exist'. A producao (Supabase)
    # tem pgvector habilitado; o banco de teste precisa espelhar isso.
    with eng.begin() as conexao:
        conexao.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine) -> Generator[Session, None, None]:
    """Sessão dentro de uma transação revertida ao fim de cada teste."""
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


def _criar_conta(db: Session, nome: str) -> tuple[Account, User]:
    conta = Account(name=nome, company_name=f"Escritorio {nome}")
    db.add(conta)
    db.flush()
    usuario = User(
        account_id=conta.id,
        email=f"{nome.lower()}-{uuid.uuid4().hex[:8]}@teste.local",
        full_name=f"Usuario {nome}",
        supabase_id=str(uuid.uuid4()),
    )
    db.add(usuario)
    db.flush()
    return conta, usuario


@pytest.fixture
def conta_a(db: Session) -> tuple[Account, User]:
    return _criar_conta(db, "ContaA")


@pytest.fixture
def conta_b(db: Session) -> tuple[Account, User]:
    return _criar_conta(db, "ContaB")


def _cliente(db: Session, usuario: User | None) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_db] = lambda: db
    if usuario is not None:
        app.dependency_overrides[get_current_user] = lambda: usuario
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client_a(db: Session, conta_a) -> Generator[TestClient, None, None]:
    yield from _cliente(db, conta_a[1])


@pytest.fixture
def client_b(db: Session, conta_b) -> Generator[TestClient, None, None]:
    yield from _cliente(db, conta_b[1])


@pytest.fixture
def client_anon(db: Session) -> Generator[TestClient, None, None]:
    yield from _cliente(db, None)

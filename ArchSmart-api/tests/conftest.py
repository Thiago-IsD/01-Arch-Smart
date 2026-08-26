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

# A regra de "isto e um banco descartavel?" vive em tools/guarda_banco.py, uma
# so, compartilhada com seed.py, reset_db.py e init_db.py. Antes da Secao 3
# cada um tinha a sua: a daqui exigia sufixo "_test" e proibia
# ("supabase.co", "supabase.com", "rds.amazonaws.com"); a do seed proibia
# ("supabase.co", "pooler.supabase.com", "render.com", "amazonaws.com") e nao
# exigia sufixo nenhum. Nenhuma das duas era superconjunto da outra, e a
# divergencia so foi notada numa revisao.
#
# A suite e MAIS estrita que a guarda dos scripts, nos DOIS eixos:
#
#   host   `exigir_host_local=True` — para os scripts, um banco chamado
#          "arqsmart_test" num Supabase ou RDS compartilhado e aceitavel (e o
#          que permite semear um staging sem flag). Para a suite nao e: a
#          fixture `engine`, abaixo, roda `drop_all`, e um servidor
#          compartilhado continua compartilhado por mais descartavel que o
#          nome do banco pareca.
#   nome   o sufixo "_test" e obrigatorio mesmo em host local. Um
#          "localhost/postgres" — o banco da stack Supabase local — passa pela
#          guarda comum e NAO pode passar aqui.
#
# Nenhum dos dois eixos e opcional, e nenhum e mais fraco do que a regra que
# esta suite tinha antes de a guarda ser unificada.
from tools.guarda_banco import (  # noqa: E402
    DestinoIlegivel,
    descrever_destino,
    motivo_de_recusa,
    nome_do_banco,
)

_motivo = motivo_de_recusa(TEST_DATABASE_URL, exigir_host_local=True)
if _motivo is not None:
    raise RuntimeError(
        f"TEST_DATABASE_URL nao serve para a suite: {_motivo} "
        f"Destino: {descrever_destino(TEST_DATABASE_URL)}. "
        "A suite apaga e recria o schema inteiro — apontar para um banco de "
        "verdade destroi dados."
    )

# nome_do_banco() da guarda, e nao um urlsplit local: o nome do banco tem UMA
# definicao, a mesma que a guarda julga e a mesma em que o psycopg2 vai cair.
# Reimplementar aqui era como o "?dbname=" escapava — a URL dizia
# ".../arqsmart_test" e a conexao ia para outro banco.
try:
    _NOME_DO_BANCO = nome_do_banco(TEST_DATABASE_URL)
except DestinoIlegivel as _erro:  # pragma: no cover - a guarda acima ja barrou
    raise RuntimeError(f"TEST_DATABASE_URL ilegivel: {_erro}.") from _erro

if not _NOME_DO_BANCO.endswith("_test"):
    raise RuntimeError(
        "TEST_DATABASE_URL precisa apontar para um banco cujo nome termina em "
        f"'_test'; a conexao cairia em {_NOME_DO_BANCO!r} "
        f"(destino: {descrever_destino(TEST_DATABASE_URL)}). A suite apaga e "
        "recria o schema inteiro; o sufixo e a ultima defesa contra apontar "
        "para um banco local que alguem usa para outra coisa."
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
    """
    Sessão dentro de uma transação revertida ao fim de cada teste.

    join_transaction_mode="rollback_only" é passado explicitamente (em vez de
    deixar o SQLAlchemy 2.0 resolver o padrão sozinho) porque duas
    consequências dependem dele e vale documentar as duas:
    1. O Session.commit() chamado dentro dos endpoints não vaza para fora da
       transação externa — é o que permite o rollback() do finally desfazer
       tudo, inclusive o que os endpoints gravaram.
    2. Um db.rollback() chamado DENTRO de um endpoint propaga para a
       transação externa e destrói os dados da fixture do teste (savepoint
       encerrado). Nenhum teste atual passa pelos db.rollback() existentes
       em product_router.py e presentations.py, mas isso é a base das
       Seções 2 a 9 — um teste futuro que exercite esse caminho vai ver
       fixtures desaparecerem no meio do teste se isso não estiver claro.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(
        bind=connection,
        autocommit=False,
        autoflush=False,
        join_transaction_mode="rollback_only",
    )()
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

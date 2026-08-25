"""
A receita de migracoes e a fonte unica do schema (ADR 0004).

Este teste constroi um banco descartavel so com `alembic upgrade head` e
compara o resultado com o que os models declaram. Se divergir, um banco novo
— staging, producao ou o Supabase local — nasce diferente do que a aplicacao
espera, e o erro so aparece em producao.

Roda contra o mesmo Postgres do docker-compose.test.yml, num banco proprio
(`arqsmart_receita_test`) para nao colidir com as fixtures da suite.
"""
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, text

from app.core import config as app_config
from app.db.base_class import Base
import app.models.all_models  # noqa: F401  (registra os models no metadata)

RAIZ = Path(__file__).resolve().parents[1]
# conftest.py exporta a URL do banco de teste em DATABASE_URL no momento em que
# e importado, antes de qualquer teste rodar.
URL_BASE = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
BANCO_RECEITA = "arqsmart_receita_test"
URL_ADMIN = f"{URL_BASE}/postgres"
URL_RECEITA = f"{URL_BASE}/{BANCO_RECEITA}"


@pytest.fixture
def banco_da_receita(monkeypatch):
    """Banco vazio que recebe so a receita de migracoes."""
    admin = create_engine(URL_ADMIN, isolation_level="AUTOCOMMIT")
    with admin.connect() as conexao:
        conexao.execute(text(f"DROP DATABASE IF EXISTS {BANCO_RECEITA}"))
        conexao.execute(text(f"CREATE DATABASE {BANCO_RECEITA}"))
    admin.dispose()

    # alembic/env.py le settings.DATABASE_URL em tempo de execucao, entao
    # trocar o atributo redireciona a receita para o banco descartavel.
    monkeypatch.setattr(app_config.settings, "DATABASE_URL", URL_RECEITA)
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    command.upgrade(cfg, "head")

    engine = create_engine(URL_RECEITA)
    yield engine
    engine.dispose()


def test_receita_reproduz_os_models(banco_da_receita):
    with banco_da_receita.connect() as conexao:
        contexto = MigrationContext.configure(conexao)
        diferencas = compare_metadata(contexto, Base.metadata)

    assert diferencas == [], (
        "O banco construido pelas migracoes diverge dos models em "
        f"{len(diferencas)} ponto(s):\n"
        + "\n".join(f"  - {d!r}" for d in diferencas)
    )


def test_schema_nao_depende_de_recurso_exclusivo_do_supabase(banco_da_receita):
    """
    Portabilidade para AWS (spec, Secao 3): a protecao real fica na aplicacao,
    nao em RLS, e o schema nao referencia as tabelas internas de autenticacao
    do Supabase. Postgres e Postgres; e o que torna a troca possivel.
    """
    with banco_da_receita.connect() as conexao:
        com_rls = conexao.execute(text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname = 'public' AND rowsecurity = true"
        )).scalars().all()
        fks_externas = conexao.execute(text(
            "SELECT DISTINCT ccu.table_schema || '.' || ccu.table_name "
            "FROM information_schema.table_constraints tc "
            "JOIN information_schema.constraint_column_usage ccu "
            "  ON tc.constraint_name = ccu.constraint_name "
            "WHERE tc.constraint_type = 'FOREIGN KEY' "
            "  AND tc.table_schema = 'public' "
            "  AND ccu.table_schema <> 'public'"
        )).scalars().all()

    assert com_rls == [], (
        f"Tabelas com RLS ligado: {com_rls}. A protecao por conta e do "
        "ScopedRepository (Secao 4), nao do banco — RLS aqui amarra o "
        "projeto ao Supabase."
    )
    assert fks_externas == [], (
        f"FK apontando para fora de public: {fks_externas}. Referencia as "
        "tabelas internas do Supabase impede migrar o banco para outro Postgres."
    )

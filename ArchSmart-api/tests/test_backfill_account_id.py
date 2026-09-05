"""
A migracao de account_id roda num banco que JA TEM linhas.

Por que este teste nao usa a fixture `db`: o schema dela vem de
`Base.metadata.create_all`, entao as linhas nasceriam com `account_id` ja
preenchido pelo ORM e a assercao conferiria o que o proprio teste garantiu —
um teste que nao testa nada. Aqui a sequencia e outra e e a de producao:

  1. `alembic upgrade <revisao PAI>`  -> schema SEM account_id nas dez
  2. INSERT por SQL cru               -> linhas legadas, como as que existem
  3. `alembic upgrade head`           -> a migracao desta tarefa roda
  4. so entao a conferencia

Se o backfill errar um nivel da arvore, o passo 3 falha no `SET NOT NULL` (e
a ADR 0007 derrubaria o deploy) ou o passo 4 acusa a divergencia.
"""
import os
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from app.core import config as app_config

RAIZ = Path(__file__).resolve().parents[1]
# conftest.py exporta a URL do banco de teste em DATABASE_URL quando e
# importado, antes de qualquer teste rodar — e e la que mora a guarda que
# recusa banco que nao seja local e terminado em `_test`.
URL_BASE = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
BANCO_BACKFILL = "arqsmart_backfill_test"
URL_ADMIN = f"{URL_BASE}/postgres"
URL_BACKFILL = f"{URL_BASE}/{BANCO_BACKFILL}"

# A revisao PAI desta migracao: a de created_by, da Tarefa 3. Leia o
# `down_revision` do arquivo que voce escreveu no Passo 4 e cole aqui — nao
# adivinhe, e nao use "head-1", que nao existe no Alembic.
REVISAO_PAI = "9a5bde3fc30f"


@pytest.fixture
def banco_no_estado_anterior(monkeypatch):
    """
    Banco PROPRIO, descartavel — mesmo padrao de
    tests/test_receita_migracoes.py::banco_da_receita, e pelo mesmo motivo:
    a fixture `db` da conftest e de sessao e ja subiu o schema inteiro com
    create_all. Mexer naquele schema no meio da suite derrubaria as fixtures
    de todos os testes seguintes.
    """
    admin = create_engine(URL_ADMIN, isolation_level="AUTOCOMMIT")
    with admin.connect() as conexao:
        conexao.execute(text(f"DROP DATABASE IF EXISTS {BANCO_BACKFILL}"))
        conexao.execute(text(f"CREATE DATABASE {BANCO_BACKFILL}"))
    admin.dispose()

    engine = create_engine(URL_BACKFILL)
    with engine.begin() as conexao:
        conexao.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    # alembic/env.py le settings.DATABASE_URL em tempo de execucao, entao
    # trocar o atributo redireciona a receita para o banco descartavel.
    monkeypatch.setattr(app_config.settings, "DATABASE_URL", URL_BACKFILL)
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    command.upgrade(cfg, REVISAO_PAI)

    yield engine, cfg
    engine.dispose()


def test_backfill_preenche_a_arvore_inteira(banco_no_estado_anterior):
    engine, cfg = banco_no_estado_anterior
    conta = uuid.uuid4()
    cliente = uuid.uuid4()
    projeto = uuid.uuid4()
    ambiente = uuid.uuid4()
    orcamento = uuid.uuid4()
    item = uuid.uuid4()
    opcao = uuid.uuid4()
    apresentacao = uuid.uuid4()

    # INSERT cru, no schema ANTIGO: nenhuma destas tabelas filhas tem
    # account_id ainda. E exatamente a forma das linhas que ja existem.
    with engine.begin() as c:
        c.execute(
            text("INSERT INTO accounts (id, name) VALUES (:i, 'Conta legada')"),
            {"i": conta},
        )
        c.execute(
            text(
                "INSERT INTO clients (id, account_id, name) "
                "VALUES (:i, :a, 'Cliente')"
            ),
            {"i": cliente, "a": conta},
        )
        c.execute(
            text(
                "INSERT INTO projects (id, account_id, client_id, name) "
                "VALUES (:i, :a, :c, 'Projeto')"
            ),
            {"i": projeto, "a": conta, "c": cliente},
        )
        c.execute(
            text(
                "INSERT INTO environments (id, project_id, name) "
                "VALUES (:i, :p, 'Sala')"
            ),
            {"i": ambiente, "p": projeto},
        )
        c.execute(
            text("INSERT INTO budgets (id, project_id) VALUES (:i, :p)"),
            {"i": orcamento, "p": projeto},
        )
        c.execute(
            text(
                "INSERT INTO budget_items (id, budget_id, environment_id, rule_type) "
                "VALUES (:i, :b, :e, 'FLOOR')"
            ),
            {"i": item, "b": orcamento, "e": ambiente},
        )
        c.execute(
            text(
                "INSERT INTO item_options (id, budget_item_id) VALUES (:i, :b)"
            ),
            {"i": opcao, "b": item},
        )
        c.execute(
            text(
                "INSERT INTO presentations (id, project_id, name, status) "
                "VALUES (:i, :p, 'Proposta', 'DRAFT')"
            ),
            {"i": apresentacao, "p": projeto},
        )

    # A migracao desta tarefa roda AGORA, sobre as linhas acima.
    command.upgrade(cfg, "head")

    with engine.begin() as c:
        # 1. Toda linha tem conta, e e a conta certa.
        for tabela, fk, pai in [
            ("environments", "project_id", "projects"),
            ("budgets", "project_id", "projects"),
            ("budget_items", "budget_id", "budgets"),
            ("item_options", "budget_item_id", "budget_items"),
            ("presentations", "project_id", "projects"),
        ]:
            divergentes = c.execute(
                text(
                    f"SELECT count(*) FROM {tabela} t "
                    f"JOIN {pai} p ON p.id = t.{fk} "
                    "WHERE t.account_id IS DISTINCT FROM p.account_id"
                )
            ).scalar()
            assert divergentes == 0, (
                f"{tabela}.account_id divergiu de {pai} depois do backfill"
            )

        # 2. A coluna fechou em NOT NULL de verdade — o `SET NOT NULL` da
        #    migracao e o que impede linha orfa nascer depois.
        obrigatorias = c.execute(
            text(
                "SELECT table_name FROM information_schema.columns "
                "WHERE column_name = 'account_id' AND is_nullable = 'NO' "
                "AND table_name IN ('environments','environment_dnas','budgets',"
                "'budget_items','item_options','presentations',"
                "'presentation_environments','presentation_acceptances',"
                "'presentation_comments','project_slots')"
            )
        ).scalars().all()
        assert len(obrigatorias) == 10, (
            "esperava as 10 tabelas com account_id NOT NULL, achei "
            f"{sorted(obrigatorias)}"
        )

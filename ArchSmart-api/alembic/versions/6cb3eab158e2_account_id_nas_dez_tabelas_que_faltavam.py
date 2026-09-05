"""account_id nas dez tabelas que faltavam

Adiciona a coluna como nullable, preenche pelo caminho de FK de cada tabela e
so entao fecha em NOT NULL. Fazer em tres tempos e o que permite a migracao
rodar num banco com dado — e ela roda no CMD do container (ADR 0007), contra
producao, sem passo manual.

A ordem dos UPDATE importa: item_options le budget_items, que le budgets.

Revision ID: 6cb3eab158e2
Revises: 9a5bde3fc30f
Create Date: 2026-09-05 14:10:22.039068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '6cb3eab158e2'
down_revision: Union[str, Sequence[str], None] = '9a5bde3fc30f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (tabela, SQL do UPDATE que preenche account_id), em ordem de dependencia.
BACKFILL = [
    (
        "project_slots",
        """
        UPDATE project_slots AS t
           SET account_id = s.account_id
          FROM subscriptions AS s
         WHERE s.id = t.subscription_id
        """,
    ),
    (
        "environments",
        """
        UPDATE environments AS t
           SET account_id = p.account_id
          FROM projects AS p
         WHERE p.id = t.project_id
        """,
    ),
    (
        "environment_dnas",
        """
        UPDATE environment_dnas AS t
           SET account_id = e.account_id
          FROM environments AS e
         WHERE e.id = t.environment_id
        """,
    ),
    (
        "budgets",
        """
        UPDATE budgets AS t
           SET account_id = p.account_id
          FROM projects AS p
         WHERE p.id = t.project_id
        """,
    ),
    (
        "budget_items",
        """
        UPDATE budget_items AS t
           SET account_id = b.account_id
          FROM budgets AS b
         WHERE b.id = t.budget_id
        """,
    ),
    (
        "item_options",
        """
        UPDATE item_options AS t
           SET account_id = bi.account_id
          FROM budget_items AS bi
         WHERE bi.id = t.budget_item_id
        """,
    ),
    (
        "presentations",
        """
        UPDATE presentations AS t
           SET account_id = p.account_id
          FROM projects AS p
         WHERE p.id = t.project_id
        """,
    ),
    (
        "presentation_environments",
        """
        UPDATE presentation_environments AS t
           SET account_id = pr.account_id
          FROM presentations AS pr
         WHERE pr.id = t.presentation_id
        """,
    ),
    (
        "presentation_acceptances",
        """
        UPDATE presentation_acceptances AS t
           SET account_id = pr.account_id
          FROM presentations AS pr
         WHERE pr.id = t.presentation_id
        """,
    ),
    (
        "presentation_comments",
        """
        UPDATE presentation_comments AS t
           SET account_id = pr.account_id
          FROM presentations AS pr
         WHERE pr.id = t.presentation_id
        """,
    ),
]

TABELAS = [tabela for tabela, _ in BACKFILL]


def upgrade() -> None:
    for tabela in TABELAS:
        op.add_column(
            tabela,
            sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=True),
        )

    for tabela, sql in BACKFILL:
        op.execute(sa.text(sql))

    for tabela in TABELAS:
        # Uma linha orfa aqui significa FK quebrada vinda de antes. Falhar alto
        # e o comportamento certo: a ADR 0007 derruba o deploy de proposito.
        op.alter_column(tabela, "account_id", nullable=False)
        op.create_foreign_key(
            f"fk_{tabela}_account_id_accounts",
            tabela,
            "accounts",
            ["account_id"],
            ["id"],
        )


def downgrade() -> None:
    for tabela in reversed(TABELAS):
        op.drop_constraint(
            f"fk_{tabela}_account_id_accounts", tabela, type_="foreignkey"
        )
        op.drop_column(tabela, "account_id")

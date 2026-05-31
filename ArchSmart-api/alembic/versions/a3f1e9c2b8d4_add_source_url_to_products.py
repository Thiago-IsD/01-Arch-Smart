"""add_source_url_to_products

Revision ID: a3f1e9c2b8d4
Revises: f1a2b3c4d5e6
Create Date: 2026-05-31 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f1e9c2b8d4'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Utiliza ALTER TABLE ... ADD COLUMN IF NOT EXISTS para compatibilidade com DEV e PROD
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url VARCHAR;")


def downgrade() -> None:
    op.drop_column('products', 'source_url')

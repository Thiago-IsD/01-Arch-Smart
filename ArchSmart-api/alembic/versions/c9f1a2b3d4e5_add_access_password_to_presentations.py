"""add_access_password_to_presentations

Revision ID: c9f1a2b3d4e5
Revises: b7c9d1e2f3a4
Create Date: 2026-07-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9f1a2b3d4e5'
down_revision: Union[str, Sequence[str], None] = 'b7c9d1e2f3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Hash da senha de acesso do cliente ao portal (nullable: pode ainda não ter sido definida).
    op.execute("ALTER TABLE presentations ADD COLUMN IF NOT EXISTS access_password_hash VARCHAR;")


def downgrade() -> None:
    op.drop_column('presentations', 'access_password_hash')

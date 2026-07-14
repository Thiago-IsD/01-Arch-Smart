"""add_rejection_reason_to_item_options

Revision ID: b7c9d1e2f3a4
Revises: d5045c9703e1
Create Date: 2026-07-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c9d1e2f3a4'
down_revision: Union[str, Sequence[str], None] = 'd5045c9703e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('item_options', sa.Column('rejection_reason', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('item_options', 'rejection_reason')

"""add_markup_and_approval_fields

Revision ID: d5045c9703e1
Revises: a3f1e9c2b8d4
Create Date: 2026-06-22 20:19:16.447360

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5045c9703e1'
down_revision: Union[str, Sequence[str], None] = 'a3f1e9c2b8d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add columns to products
    op.add_column('products', sa.Column('cost_price', sa.Float(), nullable=True))
    op.add_column('products', sa.Column('markup', sa.Float(), nullable=True))
    # Add columns to item_options
    op.add_column('item_options', sa.Column('approval_status', sa.String(), server_default='PENDING', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove columns from item_options
    op.drop_column('item_options', 'approval_status')
    # Remove columns from products
    op.drop_column('products', 'markup')
    op.drop_column('products', 'cost_price')

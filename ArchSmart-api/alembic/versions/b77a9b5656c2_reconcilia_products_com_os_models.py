"""reconcilia products com os models

Revision ID: b77a9b5656c2
Revises: c9f1a2b3d4e5
Create Date: 2026-08-24 22:19:50.252406

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b77a9b5656c2'
down_revision: Union[str, Sequence[str], None] = 'c9f1a2b3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # As cinco colunas existem nos models desde sempre e sao usadas pela
    # biblioteca de produtos, mas nenhuma migracao as criava: entraram no banco
    # do time por um ALTER TABLE rodado a mao (o antigo add_column.py). Um banco
    # criado do zero pela receita nascia sem elas.
    op.add_column('products', sa.Column('store', sa.String(), nullable=True))
    op.add_column('products', sa.Column('category', sa.String(), nullable=True))
    op.add_column('products', sa.Column('price', sa.Float(), nullable=True))
    op.add_column('products', sa.Column('dimensions', sa.JSON(), nullable=True))
    op.add_column('products', sa.Column('created_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'created_at')
    op.drop_column('products', 'dimensions')
    op.drop_column('products', 'price')
    op.drop_column('products', 'category')
    op.drop_column('products', 'store')

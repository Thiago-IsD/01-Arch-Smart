"""add_fields_to_events

Revision ID: f1a2b3c4d5e6
Revises: c7403ff445fa
Create Date: 2026-03-16 20:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '4ea450ceb50c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Adiciona campos da Feature 8.1 à tabela events:
    - description (Text, nullable)
    - meet_link (String, nullable)
    - google_event_id (String, nullable) — preparação para Google Calendar OAuth
    - created_at (DateTime, nullable com default now())

    Também garante que title, start_time e end_time sejam not-nullable
    (eram nullable antes — esta migração os corrige caso já existam dados).
    """
    # Adiciona novos campos
    op.add_column('events', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('events', sa.Column('meet_link', sa.String(), nullable=True))
    op.add_column('events', sa.Column('google_event_id', sa.String(), nullable=True))
    op.add_column('events', sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()))

    # Corrige nullability dos campos obrigatórios (se existirem registros antigos com null, preenche antes)
    op.execute("UPDATE events SET title = 'Sem título' WHERE title IS NULL")
    op.execute("UPDATE events SET start_time = NOW() WHERE start_time IS NULL")
    op.execute("UPDATE events SET end_time = NOW() + INTERVAL '1 hour' WHERE end_time IS NULL")
    op.execute("UPDATE events SET created_at = NOW() WHERE created_at IS NULL")

    op.alter_column('events', 'title', existing_type=sa.String(), nullable=False)
    op.alter_column('events', 'start_time', existing_type=sa.DateTime(), nullable=False)
    op.alter_column('events', 'end_time', existing_type=sa.DateTime(), nullable=False)
    op.alter_column('events', 'created_at', existing_type=sa.DateTime(), nullable=False)


def downgrade() -> None:
    """Remove os campos adicionados pela Feature 8.1."""
    op.alter_column('events', 'title', existing_type=sa.String(), nullable=True)
    op.alter_column('events', 'start_time', existing_type=sa.DateTime(), nullable=True)
    op.alter_column('events', 'end_time', existing_type=sa.DateTime(), nullable=True)

    op.drop_column('events', 'created_at')
    op.drop_column('events', 'google_event_id')
    op.drop_column('events', 'meet_link')
    op.drop_column('events', 'description')

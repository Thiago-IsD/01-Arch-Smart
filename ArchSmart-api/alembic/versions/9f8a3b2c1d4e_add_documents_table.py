"""add_documents_table_and_vector

Revision ID: 9f8a3b2c1d4e
Revises: 5de7aae8c076
Create Date: 2024-01-31 16:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    # Fallback in case pgvector is not installed locally (e.g. running alembic upgrade in venv)
    class Vector(sa.types.TypeDecorator):
        impl = sa.Text
        cache_ok = True
        def __init__(self, dim, *args, **kwargs):
            super(Vector, self).__init__(*args, **kwargs)

# revision identifiers, used by Alembic.
revision = '9f8a3b2c1d4e'
down_revision = '5de7aae8c076'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2. Create documents table
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_documents_id'), 'documents', ['id'], unique=False)
    
    # 3. Create RLS function (Optional but good for consistency)
    op.execute("""
        create or replace function match_documents (
            query_embedding vector(1536),
            match_threshold float,
            match_count int
        )
        returns table (
            id bigint,
            content text,
            metadata jsonb,
            similarity float
        )
        language plpgsql
        as $$
        begin
            return query
            select
                documents.id,
                documents.content,
                documents.metadata,
                1 - (documents.embedding <=> query_embedding) as similarity
            from documents
            where 1 - (documents.embedding <=> query_embedding) > match_threshold
            order by documents.embedding <=> query_embedding
            limit match_count;
        end;
        $$;
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS match_documents")
    op.drop_index(op.f('ix_documents_id'), table_name='documents')
    op.drop_table('documents')
    op.execute("DROP EXTENSION IF EXISTS vector")

import os
import sqlalchemy
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://")

engine = sqlalchemy.create_engine(db_url)

sql = """
DO $$
BEGIN
    -- 1. Revert bucket to PRIVATE
    UPDATE storage.buckets 
    SET public = false 
    WHERE id = 'secure-files';

    -- 2. Drop the Public Read policy
    DROP POLICY IF EXISTS "Public Read secure-files" ON storage.objects;

    RAISE NOTICE '✅ Reverted secure-files to PRIVATE.';
END $$;
"""

try:
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    print("✅ Successfully reverted 'secure-files' to Private.")
except Exception as e:
    print(f"❌ Failed to revert: {e}")

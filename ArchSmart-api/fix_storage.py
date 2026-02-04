import os
import sqlalchemy
from sqlalchemy import text
from dotenv import load_dotenv

# Load env
load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("❌ DATABASE_URL not found")
    exit(1)

# Fix for sqlalchemy if needed (postgres -> postgresql)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://")

print(f"🔌 Connecting to DB...")
engine = sqlalchemy.create_engine(db_url)

sql = """
DO $$
BEGIN
    -- 1. Ensure bucket exists and is public
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('secure-files', 'secure-files', true)
    ON CONFLICT (id) DO UPDATE SET public = true;

    -- 2. Create Policy for Public Read if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Public Read secure-files'
    ) THEN
        CREATE POLICY "Public Read secure-files"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'secure-files');
    END IF;

    RAISE NOTICE '✅ Policies updated successfully';
END $$;
"""

try:
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    print("✅ Successfully updated storage policies for 'secure-files'.")
except Exception as e:
    print(f"❌ Failed to execute SQL: {e}")

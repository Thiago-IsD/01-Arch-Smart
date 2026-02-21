import sys
import os
from sqlalchemy import text

sys.path.append(os.getcwd())
from app.db.session import SessionLocal

def add_column():
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url VARCHAR;"))
        db.commit()
        print("Column source_url added successfully!")
    except Exception as e:
        print(f"Error adding column: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_column()

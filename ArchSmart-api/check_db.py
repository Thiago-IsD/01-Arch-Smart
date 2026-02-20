
import sys
import os
from sqlalchemy import create_engine, inspect
from app.core.config import settings

def check_db():
    print(f"Checking connection to: {settings.DATABASE_URL.split('@')[1]}") # Hide password
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"✅ Connection successful!")
        print(f"📊 Tables found: {tables}")
        
        if "products" in tables:
            print("✅ 'products' table exists.")
            columns = [c['name'] for c in inspector.get_columns("products")]
            print(f"📊 Columns: {columns}")
            
            # Test Query
            from sqlalchemy.orm import Session
            session = Session(engine)
            try:
                from app.models.all_models import Product
                count = session.query(Product).count()
                print(f"✅ Product count: {count}")
                first = session.query(Product).first()
                if first:
                    print(f"✅ First product: {first.name}")
            except Exception as e:
                print(f"❌ Query failed: {e}")
                import traceback
                traceback.print_exc()
            finally:
                session.close()
        else:
            print("❌ 'products' table MISSING.")
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    check_db()

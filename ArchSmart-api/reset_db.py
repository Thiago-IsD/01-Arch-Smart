
import sys
import os
from sqlalchemy import create_engine, text

# Add the project root to the python path so we can import app modules
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '..')) # Assuming script is in scripts/ or root
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    from app.core.config import settings
except ImportError:
    # If standard import fails, try relative or assume user runs from root
    sys.path.append(os.getcwd())
    from app.core.config import settings

def reset_database():
    print(f"Connecting to database...")
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as connection:
        trans = connection.begin()
        try:
            print("Dropping schema public...")
            connection.execute(text("DROP SCHEMA public CASCADE;"))
            print("Recreating schema public...")
            connection.execute(text("CREATE SCHEMA public;"))
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector;")) # Required for Document model
            trans.commit()
            print("Schema reset successfully.")
    
            # Create tables
            from app.db.base import Base
            from app.models.all_models import Product, Account, ProductOrigin, ProductState, Document # Import all
            print(f"Registered tables: {Base.metadata.tables.keys()}")
            print("Creating tables...")
            Base.metadata.create_all(bind=engine)
            print("Tables created successfully.")
        except Exception as e:
            trans.rollback()
            print(f"Error during reset: {e}")
            raise

if __name__ == "__main__":
    reset_database()

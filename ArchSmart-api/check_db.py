from app.db.session import engine
from sqlalchemy import inspect
inspector = inspect(engine)
try:
    columns = [c['name'] for c in inspector.get_columns('leads')]
    print(f"Columns in leads: {columns}")
except Exception as e:
    print(f"Error: {e}")

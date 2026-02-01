import sys
import os

# Add current directory to path so 'app' module can be found
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.all_models import User

def check_users():
    try:
        db = SessionLocal()
        users = db.query(User).all()
        print(f"Total Users: {len(users)}")
        for u in users:
            print(f" - {u.email} (ID: {u.id}, Role: {u.role})")
    except Exception as e:
        print(f"Error checking users: {e}")

if __name__ == "__main__":
    check_users()

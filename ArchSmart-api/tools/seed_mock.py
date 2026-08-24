import os
from dotenv import load_dotenv

load_dotenv(".env")

from app.db.session import SessionLocal
from app.models.all_models import User, Account
import uuid

def seed():
    db = SessionLocal()
    
    # Check if exists
    user = db.query(User).filter(User.email == "email@email.com").first()
    if user:
        print("User already exists")
        return
        
    account = Account(
        name="Conta Ficticia",
        company_name="Mock Corp",
        is_active=True
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    
    new_user = User(
        supabase_id="00000000-0000-0000-0000-000000000000",
        email="email@email.com",
        full_name="Usuario Mock",
        account_id=account.id,
        role="ARCHITECT"
    )
    db.add(new_user)
    db.commit()
    print("Created mock user: email@email.com")

if __name__ == "__main__":
    seed()

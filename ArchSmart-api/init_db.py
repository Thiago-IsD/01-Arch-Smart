import os
from dotenv import load_dotenv

# Load env file first
load_dotenv(".env")

from app.db.session import engine
from app.models.all_models import Base

def init_db():
    print("Creating mock database tables...")
    Base.metadata.create_all(bind=engine)
    print("Done!")

if __name__ == "__main__":
    init_db()

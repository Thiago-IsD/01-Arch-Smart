from app.db.session import SessionLocal
from app.models.all_models import Lead
try:
    db = SessionLocal()
    new_lead = Lead(
        name="Debug User",
        email="debug@test.com",
        phone="123456789",
        active_projects=5,
        origin="DEBUG"
    )
    db.add(new_lead)
    db.commit()
    print("Successfully added lead")
except Exception as e:
    print(f"Error adding lead: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()

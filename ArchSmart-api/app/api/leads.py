from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import Lead
from app.schemas.lead import LeadCreate

router = APIRouter()

@router.post("/leads", status_code=status.HTTP_201_CREATED)
def create_lead(lead: LeadCreate, db: Session = Depends(get_db)):
    # Check if email already exists
    existing_lead = db.query(Lead).filter(Lead.email == lead.email).first()
    if existing_lead:
        # Assuming we just return success or update? 
        # Requirement says: Return 400 ("E-mail já cadastrado")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="E-mail já cadastrado"
        )
    
    new_lead = Lead(
        name=lead.name,
        email=lead.email,
        phone=lead.phone,
        origin=lead.origin,
        active_projects=lead.active_projects,
        account_id=None # Pre-registration
    )
    
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    
    return {"message": "Lead created successfully", "id": str(new_lead.id)}


import sys
import os
from sqlalchemy.orm import Session

# Add project root to path
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.all_models import Product, ProductState, ProductStateStatus, ProductOrigin, ProductOriginType, Account

def seed_captured():
    db = SessionLocal()
    try:
        print("Seeding captured data...")
        
        # 1. Get an Account
        account = db.query(Account).first()
        if not account:
            account = Account(name="Demo Account", company_name="Arch Smart Demo")
            db.add(account)
            db.commit()
            db.refresh(account)

        # 2. Ensure CAPTURED state exists
        captured_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.CAPTURED).first()
        if not captured_state:
            captured_state = ProductState(name="Captured", status=ProductStateStatus.CAPTURED)
            db.add(captured_state)
            
        clipper_origin = db.query(ProductOrigin).filter(ProductOrigin.type == ProductOriginType.WEB_CLIPPER).first()
        if not clipper_origin:
            clipper_origin = ProductOrigin(name="Web Clipper", type=ProductOriginType.WEB_CLIPPER)
            db.add(clipper_origin)

        db.commit()
        db.refresh(captured_state)
        db.refresh(clipper_origin)

        # 3. Create 2 Captured Products (missing dimensions)
        p1 = Product(
            account_id=account.id,
            name="Sofa Modular Cinza (Bruto)",
            store="Tok&Stok",
            category=None, # Missing
            price=3200.00,
            image_url="https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=500",
            state_id=captured_state.id,
            origin_id=clipper_origin.id,
            dimensions=None # Missing dimensions
        )

        p2 = Product(
            account_id=account.id,
            name="Luminária Pendente Industrial",
            store="Westwing",
            category="Iluminação",
            price=None, # Missing price
            image_url="https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&q=80&w=500",
            state_id=captured_state.id,
            origin_id=clipper_origin.id,
            dimensions=None # Missing dimensions
        )

        db.add(p1)
        db.add(p2)
        
        db.commit()
        print("Seeding captured products complete!")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_captured()

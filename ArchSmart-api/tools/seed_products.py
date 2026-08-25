
import sys
import os
from sqlalchemy.orm import Session

# Add project root to path
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.all_models import Product, ProductState, ProductStateStatus, ProductOrigin, ProductOriginType, Account

def seed_data():
    db = SessionLocal()
    try:
        print("Seeding data...")
        
        # 1. Create Account (Required for Product)
        account = Account(name="Demo Account", company_name="Arch Smart Demo")
        db.add(account)
        db.commit()
        db.refresh(account)
        print(f"Created Account: {account.id}")

        # 2. Ensure States and Origins exist
        normalized_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.NORMALIZED).first()
        if not normalized_state:
            normalized_state = ProductState(name="Normalized", status=ProductStateStatus.NORMALIZED)
            db.add(normalized_state)
        
        manual_origin = db.query(ProductOrigin).filter(ProductOrigin.type == ProductOriginType.MANUAL).first()
        if not manual_origin:
            manual_origin = ProductOrigin(name="Manual", type=ProductOriginType.MANUAL)
            db.add(manual_origin)
            
        clipper_origin = ProductOrigin(name="Web Clipper", type=ProductOriginType.WEB_CLIPPER)
        db.add(clipper_origin)
        
        shopping_origin = ProductOrigin(name="Shopping Hub", type=ProductOriginType.SHOPPING_HUB)
        db.add(shopping_origin)

        db.commit()
        db.refresh(normalized_state)
        db.refresh(manual_origin)
        db.refresh(clipper_origin)
        db.refresh(shopping_origin)

        # 3. Create Products
        # 3. Create Products (Generate 50 items for pagination testing)
        import random
        
        categories = ["Cadeiras", "Poltronas", "Sofás", "Mesas", "Luminárias", "Decoração"]
        stores = ["Herman Miller", "Westwing", "Mobly", "Tok&Stok", "Etna", "Arquivo Contemporâneo"]
        
        products = []
        
        # Add some fixed ones for specific testing
        products.append(Product(
            account_id=account.id,
            name="Cadeira Eames com Base de Madeira DSW - Branca",
            store="Herman Miller",
            category="Cadeiras",
            price=1250.00,
            image_url="https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&q=80&w=500",
            state_id=normalized_state.id,
            origin_id=manual_origin.id
        ))
        
        # Generate random products
        for i in range(50):
            cat = random.choice(categories)
            origin_ref = random.choice([manual_origin, clipper_origin, shopping_origin])
            price = round(random.uniform(100.0, 5000.0), 2)
            
            products.append(Product(
                account_id=account.id,
                name=f"{cat} Design {i+1} - {random.choice(['Luxo', 'Standard', 'Premium'])}",
                store=random.choice(stores),
                category=cat,
                price=price,
                image_url=None,
                state_id=normalized_state.id,
                origin_id=origin_ref.id
            ))

        for p in products:
            db.add(p)
        
        db.commit()
        print("Seeding complete!")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()

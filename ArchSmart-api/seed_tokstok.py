import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.all_models import Product, ProductState, ProductStateStatus, ProductOrigin, ProductOriginType, Account
import uuid

def seed_tokstok():
    db = SessionLocal()
    try:
        print("Seeding TokStok captured data...")
        account = db.query(Account).first()
        captured_state = db.query(ProductState).filter(ProductState.status == ProductStateStatus.CAPTURED).first()
        clipper_origin = db.query(ProductOrigin).filter(ProductOrigin.type == ProductOriginType.WEB_CLIPPER).first()

        p1 = Product(
            account_id=account.id,
            name="Sofa Cama 3 Lugares Malaquita Preto",
            store="Tok&Stok",
            category="Mobiliário",
            price=None,
            source_url="https://www.tokstok.com.br/sofa-cama-3-lugares-malaquita-preto-marad/p?idsku=427782",
            image_url="https://tokstok.vtexassets.com/arquivos/ids/6234057-798-798",
            state_id=captured_state.id,
            origin_id=clipper_origin.id,
            dimensions=None
        )

        db.add(p1)
        db.commit()
        print("Seeding TokStok complete!")

    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_tokstok()

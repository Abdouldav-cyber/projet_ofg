import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, set_tenant_schema
from sqlalchemy import text
from app.models import User
from app.security import get_password_hash

def main():
    db = SessionLocal()
    # Forcer la création de toutes les tables dans le schéma public
    try:
        db.execute(text("SELECT create_tenant_tables('public')"))
        db.commit()
    except Exception as e:
        print("Erreur création tables:", e)
        db.rollback()

    set_tenant_schema(db, "public")
    email = "admin@fintrack.com"
    pwd = "password123!"

    user = db.query(User).filter(User.email == email).first()
    if not user:
        new_user = User(
            email=email, 
            password_hash=get_password_hash(pwd), 
            role="superadmin", 
            is_active=True,
            kyc_status="approved"
        )
        db.add(new_user)
        print("User created")
    else:
        user.password_hash = get_password_hash(pwd)
        print("User password updated")
    
    db.commit()

if __name__ == "__main__":
    main()

import sys
import os

# Ajout du chemin pour importer l'app FastAPI
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, set_tenant_schema
from app.models import User, Account, AccountBalance
from app.security import get_password_hash
import uuid

def create_default_admin():
    db = SessionLocal()
    tenant_code = "SN"
    
    # On se place dans le schema du Senegal
    set_tenant_schema(db, tenant_code)
    
    email = "admin@djembe-bank.com"
    password = "password123!"
    
    user = db.query(User).filter(User.email == email).first()
    if user:
        print(f"L'utilisateur {email} existe deja. Maj du mot de passe...")
        user.password_hash = get_password_hash(password)
        db.commit()
        print("Mot de passe reinitialise avec succes :", password)
        return
        
    print(f"Creation de l'utilisateur {email}...")
    new_user = User(
        email=email,
        first_name="Admin",
        last_name="Systeme",
        role="admin",
        password_hash=get_password_hash(password),
        is_active=True,
        kyc_status="approved",
        mfa_enabled=False
    )
    db.add(new_user)
    db.commit()
    print("Administrateur cree avec succes dans le tenant SN !")
    print(f"Email: {email}")
    print(f"Password: {password}")
    print(f"Code Pays: SN")

if __name__ == "__main__":
    create_default_admin()

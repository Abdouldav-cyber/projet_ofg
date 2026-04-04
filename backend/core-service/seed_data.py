import sys
import os
import random
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, set_tenant_schema
from app.models import User, Account, AccountBalance, Card, Transaction
from app.security import get_password_hash
import uuid

def seed_database():
    db = SessionLocal()
    tenant_code = "SN"
    print(f"Connexion au schéma {tenant_code}...")
    set_tenant_schema(db, tenant_code)

    # Noms fictifs
    names = [
        ("Amadou", "Diop"),
        ("Fatou", "Ndiaye"),
        ("Ousmane", "Sow"),
        ("Aissatou", "Fall"),
        ("Moussa", "Diallo")
    ]

    users_created = []

    for first, last in names:
        email = f"{first.lower()}.{last.lower()}@example.com"
        
        # Vérifier si l'utilisateur existe
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Création de l'utilisateur {first} {last}...")
            user = User(
                email=email,
                first_name=first,
                last_name=last,
                phone=f"+22177{random.randint(1000000, 9999999)}",
                role="customer",
                password_hash=get_password_hash("password123"),
                is_active=True,
                kyc_status="approved",
                mfa_enabled=False
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            print(f"L'utilisateur {email} existe déjà.")
            
        users_created.append(user)

        # Vérifier s'il a un compte
        account = db.query(Account).filter(Account.user_id == user.id).first()
        if not account:
            print(f"  Création d'un compte pour {first}...")
            account = Account(
                user_id=user.id,
                account_type="personal",
                iban=f"SN{random.randint(100, 999)}01{random.randint(10000000000, 99999999999)}",
                bic="DJEMBESND",
                status="active",
                daily_limit="500000",
                monthly_limit="5000000"
            )
            db.add(account)
            db.commit()
            db.refresh(account)

            # Soldes
            balance = AccountBalance(
                account_id=account.id,
                currency="XOF",
                available=str(random.randint(10000, 500000)),
                pending="0"
            )
            db.add(balance)

            # Cartes
            card_types = ["physical", "virtual"]
            for c_type in card_types:
                card = Card(
                    account_id=account.id,
                    card_type=c_type,
                    last_4_digits=str(random.randint(1000, 9999)),
                    card_number_hash="hashed_card_num_mock",
                    cvv_hash="hashed_cvv_mock",
                    expiry_date=(datetime.now(timezone.utc) + timedelta(days=random.randint(300, 1000))).date(),
                    pin_hash="hashed_pin",
                    status="active",
                    daily_limit="100000",
                    monthly_limit="500000"
                )
                db.add(card)
            
            db.commit()
            print(f"  Compte, Solde et Cartes créés.")

    # Création de Transactions aléatoires entre eux
    print("Génération de l'historique de transactions...")
    for _ in range(15):
        sender = random.choice(users_created)
        receiver = random.choice([u for u in users_created if u.id != sender.id])
        
        sender_acc = db.query(Account).filter(Account.user_id == sender.id).first()
        receiver_acc = db.query(Account).filter(Account.user_id == receiver.id).first()
        
        if sender_acc and receiver_acc:
            amount = random.randint(1000, 25000)
            
            tx = Transaction(
                from_account_id=sender_acc.id,
                to_account_id=receiver_acc.id,
                amount=str(amount),
                currency="XOF",
                reference=f"REF-{uuid.uuid4().hex[:8].upper()}",
                transaction_type="internal",
                status="completed",
                created_at=(datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 150))).replace(tzinfo=None)
            )
            db.add(tx)
    
    db.commit()
    print("Seed data terminé avec succès !")

if __name__ == "__main__":
    seed_database()

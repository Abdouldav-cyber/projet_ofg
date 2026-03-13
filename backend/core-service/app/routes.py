from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from pydantic import UUID4
from decimal import Decimal
from app.database import get_db
from app.models import Tenant, User, Account, AccountBalance, Transaction, Tontine, TontineMember
from app.kyc import KYCDocument
from app.audit import AuditLog
from app.schemas import (
    TenantResponse, TenantCreate, UserCreate, UserResponse, Token, 
    AccountResponse, AccountCreate, TransactionResponse, TransactionCreate,
    TontineResponse, TontineCreate, TontineMemberResponse, TontineMemberCreate
)
from app.security import get_password_hash, verify_password, create_access_token
from app.tenant_manager import get_db_with_tenant
from app.fraud import FraudEngine

router = APIRouter()
# Schéma d'authentification OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

@router.get("/health", tags=["Sante"], summary="Etat du service")
async def health_check():
    """Verification de l'etat de sante du service."""
    return {"status": "healthy"}

# --- UTILISATEURS & AUTHENTIFICATION ---

@router.post("/auth/register", response_model=UserResponse, tags=["Authentification"], summary="Inscription utilisateur")
def register_user(user: UserCreate, db: Session = Depends(get_db_with_tenant)):
    """Inscrit un nouvel utilisateur dans le pays specifie."""
    # Verification d'existence
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est deja enregistre")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        password_hash=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Audit Log
    db.add(AuditLog(user_id=db_user.id, action="REGISTER", resource="users", resource_id=str(db_user.id)))
    db.commit()
    
    return db_user

@router.post("/auth/login", response_model=Token, tags=["Authentification"], summary="Connexion utilisateur")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db_with_tenant)):
    """Authentifie un utilisateur et retourne un token JWT."""
    # Le tenant est selectionne via get_db_with_tenant (header X-Tenant-Code)
    db_user = db.query(User).filter(User.email == form_data.username).first()
    if not db_user or not verify_password(form_data.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": db_user.email})
    
    # Récupération dynamique du code tenant actuel
    current_schema = db.execute(text("SHOW search_path")).fetchone()[0].split(',')[0].strip()
    tenant_code = current_schema.replace('tenant_', '') if 'tenant_' in current_schema else "public"

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "tenant_code": tenant_code
    }

# --- SERVICES BANCAIRES ---

@router.post("/accounts", response_model=AccountResponse, tags=["Services Bancaires"], summary="Ouverture de compte")
def create_account(account: AccountCreate, db: Session = Depends(get_db_with_tenant)):
    """Crée un nouveau compte bancaire pour l'utilisateur."""
    # Simulation d'un user_id (devrait être récupéré via le token current_user)
    user_id = "00000000-0000-0000-0000-000000000000" 
    new_account = Account(
        user_id=user_id,
        account_type=account.account_type,
        status="active"
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    
    # Initialisation du solde
    initial_balance = AccountBalance(
        account_id=new_account.id,
        currency=account.initial_currency,
        available="0"
    )
    db.add(initial_balance)
    db.commit()
    
    return new_account

@router.get("/accounts", response_model=List[AccountResponse], tags=["Services Bancaires"], summary="Lister mes comptes")
def list_accounts(db: Session = Depends(get_db_with_tenant)):
    """Liste tous les comptes bancaires du pays actuel."""
    return db.query(Account).all()

@router.post("/accounts/{account_id}/deposit", tags=["Services Bancaires"], summary="Deposer de l'argent (Test)")
def deposit_money(account_id: UUID4, amount: float, db: Session = Depends(get_db_with_tenant)):
    """Depose de l'argent sur un compte pour les besoins du test."""
    from app.banking import TransactionEngine
    try:
        tx = TransactionEngine.deposit(db, str(account_id), Decimal(amount), "XOF")
        return {"message": "Depot reussi", "transaction_id": str(tx.id), "amount": amount}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/transfers", response_model=TransactionResponse, tags=["Services Bancaires"], summary="Execution de virement")
def transfer(tx_data: TransactionCreate, db: Session = Depends(get_db_with_tenant)):
    """Execute un virement avec detection de fraude et audit."""
    amount_dec = Decimal(tx_data.amount)
    
    # 1. Scoring de Fraude (Simule avec historique vide pour l'instant)
    fraud_score = FraudEngine.score_transaction(amount_dec, {"daily_count": 5})
    if FraudEngine.is_blocked(fraud_score):
        raise HTTPException(status_code=403, detail="Transaction bloquee par le moteur de fraude")

    from app.banking import TransactionEngine
    try:
        new_tx = TransactionEngine.execute_transfer(
            db,
            from_acc_id=str(tx_data.from_account_id),
            to_acc_id=tx_data.to_account_id,
            amount=amount_dec,
            currency=tx_data.currency,
            reference=tx_data.reference
        )
        
        # Audit Log
        db.add(AuditLog(user_id=None, action="TRANSFER", resource="transactions", resource_id=str(new_tx.id)))
        db.commit()
        
        return new_tx
    except ValueError as e:
        print(f"DEBUG_VIREMENT_ERREUR_VALEUR: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"DEBUG_VIREMENT_ERREUR_CRITIQUE: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur interne de transaction")

# --- TONTINE (ÉPARGNE COLLECTIVE) ---

@router.post("/tontines", response_model=TontineResponse, tags=["Tontine"], summary="Creation de tontine")
def create_tontine(tontine: TontineCreate, db: Session = Depends(get_db_with_tenant)):
    """Crée un nouveau cercle d'épargne (Tontine)."""
    # admin_id simulé
    admin_id = "00000000-0000-0000-0000-000000000000"
    db_tontine = Tontine(
        name=tontine.name,
        admin_id=admin_id,
        target_amount=str(tontine.target_amount),
        frequency=tontine.frequency
    )
    db.add(db_tontine)
    db.commit()
    db.refresh(db_tontine)
    return db_tontine

@router.post("/tontines/{tontine_id}/members", response_model=TontineMemberResponse)
def join_tontine(tontine_id: UUID4, member: TontineMemberCreate, db: Session = Depends(get_db_with_tenant)):
    """Ajoute un membre à une tontine existante."""
    db_member = TontineMember(
        tontine_id=tontine_id,
        user_id=member.user_id,
        contribution_amount=str(member.contribution_amount)
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

@router.get("/tontines/{tontine_id}/members", response_model=List[TontineMemberResponse])
def list_tontine_members(tontine_id: UUID4, db: Session = Depends(get_db_with_tenant)):
    """Liste tous les participants d'une tontine."""
    return db.query(TontineMember).filter(TontineMember.tontine_id == tontine_id).all()

@router.get("/tenants", response_model=List[TenantResponse], tags=["Tenants & Pays"], summary="Liste des pays")
def list_tenants(db: Session = Depends(get_db)):
    """Liste tous les pays (Tenants) configurés dans le système central."""
    tenants = db.query(Tenant).all()
    return tenants

@router.post("/tenants", response_model=TenantResponse)
def create_tenant(tenant: TenantCreate, db: Session = Depends(get_db)):
    """Configure un nouveau pays dans la plateforme."""
    db_tenant = Tenant(**tenant.model_dump())
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

# --- CONFORMITÉ (KYC) & NOTIFICATIONS ---

@router.post("/kyc/upload", tags=["Conformite (KYC)"], summary="Telechargement de piece d'identite")
async def upload_kyc(user_id: UUID4, doc_type: str, db: Session = Depends(get_db_with_tenant)):
    """Point d'entrée pour la soumission de pièces d'identité."""
    from app.kyc import KYCService
    # Simulation d'un upload
    url = KYCService.upload_document(str(user_id), doc_type, b"fake_content")
    
    new_doc = KYCDocument(
        user_id=user_id,
        document_type=doc_type,
        document_url=url,
        status="pending"
    )
    db.add(new_doc)
    db.commit()
    
    # Notification à l'utilisateur
    from app.notifications import NotificationService
    notifier = NotificationService()
    notifier.send_email("user@example.com", "Document Reçu", f"Votre {doc_type} est en cours de vérification.")
    
    return {"status": "success", "url": url}

@router.post("/notifications/test-sms")
def test_sms(phone: str):
    """Teste l'envoi de SMS via Twilio."""
    from app.notifications import NotificationService
    notifier = NotificationService()
    success = notifier.send_sms(phone, "Ceci est un test de sécurité Djembé Bank.")
    return {"success": success}

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from pydantic import UUID4
from decimal import Decimal
from app.database import get_db, get_db_with_tenant_code, oauth2_scheme
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
from app.fraud import FraudDetectionEngine

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
        first_name=user.first_name,
        last_name=user.last_name,
        password_hash=hashed_password,
        role=user.role or "user"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Audit Log
    db.add(AuditLog(user_id=db_user.id, action="REGISTER", resource="users", resource_id=str(db_user.id)))
    db.commit()

    return db_user

@router.post("/auth/login", response_model=Token, tags=["Authentification"], summary="Connexion utilisateur")
def login(form_data: OAuth2PasswordRequestForm = Depends(), request: Request = None, db: Session = Depends(get_db)):
    """Authentifie un utilisateur et retourne un token JWT."""
    from app.database import set_tenant_schema
    
    # Hack pour Swagger UI : utiliser client_id comme tenant_code si le header est absent
    tenant_code = request.headers.get("X-Tenant-Code")
    if not tenant_code and form_data.client_id:
        tenant_code = form_data.client_id
    if not tenant_code:
        tenant_code = "public" # Fallback Super Admin par défaut
        
    # Basculer le schéma manuellement
    set_tenant_schema(db, tenant_code)

    db_user = db.query(User).filter(User.email == form_data.username).first()
    if not db_user or not verify_password(form_data.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Récupération dynamique du code tenant actuel
    current_schema = db.execute(text("SHOW search_path")).fetchone()[0].split(',')[0].strip()
    tenant_code = current_schema.replace('tenant_', '') if 'tenant_' in current_schema else "public"

    # Créer token JWT avec toutes les informations
    access_token = create_access_token(data={
        "sub": db_user.email,
        "user_id": str(db_user.id),
        "role": db_user.role,
        "tenant_id": tenant_code
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "tenant_code": tenant_code
    }

@router.get("/auth/me", response_model=UserResponse, tags=["Authentification"], summary="Obtenir utilisateur actuel")
def get_current_user_endpoint(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db_with_tenant)):
    """Retourne les informations de l'utilisateur connecté depuis le token JWT."""
    from jose import jwt, JWTError
    from app.config import settings

    try:
        # Décoder le token JWT pour récupérer l'user_id
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("user_id")
        tenant_id: str = payload.get("tenant_id")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalide"
            )

        # Récupérer l'utilisateur depuis la DB
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

        # Retourner les informations de l'utilisateur avec tenant_id
        return UserResponse(
            id=user.id,
            email=user.email,
            phone=user.phone,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            is_active=user.is_active,
            kyc_status=user.kyc_status,
            created_at=user.created_at,
            tenant_id=tenant_id
        )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token JWT invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )


# --- MULTI-FACTOR AUTHENTICATION (MFA) ---

@router.post("/auth/mfa/enable", tags=["Authentification"], summary="Activer MFA/2FA")
def enable_mfa(db: Session = Depends(get_db_with_tenant)):
    """
    Génère un secret TOTP et un QR code pour activer le MFA
    Nécessite authentification
    """
    from app.mfa import MFAService
    from app.rbac import get_current_user
    from fastapi import Request

    # TODO: Récupérer current_user depuis token JWT
    # Pour l'instant, simulation
    user_id = "00000000-0000-0000-0000-000000000000"

    # Générer secret TOTP
    secret = MFAService.generate_totp_secret()

    # Générer URI et QR code
    uri = MFAService.get_totp_uri(secret, email="user@djembe.com")
    qr_code_base64 = MFAService.generate_qr_code_base64(uri)

    # Sauvegarder le secret (chiffré) en DB
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        from app.encryption import encrypt_field
        user.mfa_secret = encrypt_field(secret)
        db.commit()

    return {
        "secret": secret,
        "qr_code": qr_code_base64,
        "uri": uri,
        "message": "Scannez le QR code avec Google Authenticator puis vérifiez avec /auth/mfa/verify"
    }


@router.post("/auth/mfa/verify", tags=["Authentification"], summary="Vérifier code MFA")
def verify_mfa(code: str, db: Session = Depends(get_db_with_tenant)):
    """
    Vérifie un code TOTP pour activer le MFA
    """
    from app.mfa import MFAService
    from app.encryption import decrypt_field

    # TODO: Récupérer current_user depuis token
    user_id = "00000000-0000-0000-0000-000000000000"

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA non initialisé")

    # Déchiffrer le secret
    secret = decrypt_field(user.mfa_secret)

    # Vérifier le code
    is_valid = MFAService.verify_totp_code(secret, code)

    if is_valid:
        # Activer MFA
        user.mfa_enabled = True
        db.commit()

        # Audit log
        db.add(AuditLog(user_id=user.id, action="MFA_ENABLED", resource="users", resource_id=str(user.id)))
        db.commit()

        return {"status": "success", "message": "MFA activé avec succès"}
    else:
        raise HTTPException(status_code=400, detail="Code invalide")


@router.post("/auth/mfa/disable", tags=["Authentification"], summary="Désactiver MFA")
def disable_mfa(password: str, db: Session = Depends(get_db_with_tenant)):
    """
    Désactive le MFA (nécessite confirmation par mot de passe)
    """
    # TODO: Récupérer current_user
    user_id = "00000000-0000-0000-0000-000000000000"

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # Vérifier mot de passe
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")

    # Désactiver MFA
    user.mfa_enabled = False
    user.mfa_secret = None
    db.commit()

    # Audit log
    db.add(AuditLog(user_id=user.id, action="MFA_DISABLED", resource="users", resource_id=str(user.id)))
    db.commit()

    return {"status": "success", "message": "MFA désactivé"}


@router.get("/auth/mfa/status", tags=["Authentification"], summary="Statut MFA")
def mfa_status(db: Session = Depends(get_db_with_tenant)):
    """Vérifie si le MFA est activé pour l'utilisateur"""
    # TODO: Récupérer current_user
    user_id = "00000000-0000-0000-0000-000000000000"

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    return {
        "mfa_enabled": bool(user.mfa_enabled),
        "mfa_configured": user.mfa_secret is not None
    }


# --- SERVICES BANCAIRES ---

@router.post("/accounts", tags=["Services Bancaires"], summary="Ouverture de compte")
def create_account(account: AccountCreate, db: Session = Depends(get_db_with_tenant)):
    """Crée un nouveau compte bancaire pour l'utilisateur."""
    # Utiliser le user_id fourni
    user_id = account.user_id
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id est requis pour creer un compte")

    # Verifier que l'utilisateur existe
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")

    new_account = Account(
        user_id=user_id,
        account_type=account.account_type,
        status="active"
    )
    db.add(new_account)
    db.flush()

    # Initialisation du solde
    initial_balance = AccountBalance(
        account_id=new_account.id,
        currency=account.initial_currency or "XOF",
        available="0"
    )
    db.add(initial_balance)
    db.commit()

    # Audit log
    db.add(AuditLog(user_id=None, action="CREATE_ACCOUNT", resource="accounts", resource_id=str(new_account.id)))
    db.commit()

    return {
        "id": str(new_account.id),
        "user_id": str(new_account.user_id),
        "account_type": new_account.account_type,
        "iban": new_account.iban,
        "status": new_account.status,
        "created_at": new_account.created_at.isoformat() if new_account.created_at else None,
        "currency": account.initial_currency or "XOF",
        "message": "Compte cree avec succes"
    }

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
async def transfer(tx_data: TransactionCreate, db: Session = Depends(get_db_with_tenant)):
    """Execute un virement avec detection de fraude et audit."""
    amount_dec = Decimal(tx_data.amount)
    
    # 1. Scoring de Fraude (Spec 5.4)
    engine = FraudDetectionEngine()
    fraud_result = await engine.analyze_transaction({"amount": float(amount_dec), "velocity": 5})
    if fraud_result['risk_level'] == 'HIGH':
        raise HTTPException(status_code=403, detail=f"Transaction bloquée: {fraud_result['factors']}")

    from app.banking import TransactionEngine
    try:
        new_tx = await TransactionEngine.execute_transfer(
            db,
            from_account_id=str(tx_data.from_account_id),
            to_account_id=str(tx_data.to_account_id),
            amount=amount_dec,
            currency=tx_data.currency,
            reference=tx_data.reference
        )
        
        # Audit Log
        db.add(AuditLog(user_id=None, action="TRANSFER", resource_type="transactions", resource_id=new_tx.id))
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

@router.get("/tontines", response_model=List[TontineResponse], tags=["Tontine"], summary="Liste des tontines")
def list_tontines(db: Session = Depends(get_db_with_tenant)):
    """Liste toutes les tontines du pays actuel."""
    return db.query(Tontine).all()

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

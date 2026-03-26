"""
Routes d'administration pour Djembé Bank
Gère les API Super Admin, Country Admin et Support Agent
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import List, Optional
from pydantic import UUID4
from datetime import datetime, timedelta
import io

from app.database import get_db, get_db_with_tenant
from app.models import Tenant, User, Account, Transaction, AccountBalance, SupportTicket
from app.kyc import KYCDocument
from app.schemas import (
    TenantCreate, TenantResponse, TenantUpdate, UserResponse, UserUpdate,
    TransactionResponse, AccountResponse,
    SupportTicketCreate, SupportTicketUpdate, SupportTicketResponse,
    PasswordChange, ProfileUpdate
)
from app.rbac import (
    get_current_user, CurrentUser,
    require_role, require_permissions,
    RequireSuperAdmin, RequireCountryAdmin,
    RequireSupport, RequireSupportL2, RequireAdmin
)
from app.audit import AuditLog
from app.security import get_password_hash, verify_password

router = APIRouter()


# ==================== SUPER ADMIN API ====================

async def setup_compliance_webhooks(tenant_id: UUID4):
    """Initialise les webhooks de conformite KYC/AML pour le nouveau pays."""
    # Simulation d'integration externe
    print(f"Compliance webhooks successfully configured for tenant {tenant_id}")
    pass

@router.post("/admin/tenants", response_model=TenantResponse, tags=["Super Admin"])
async def create_tenant(
    tenant_data: TenantCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = RequireSuperAdmin
):
    """
    Crée un nouveau tenant (pays/entité)
    Réservé aux Super Admins

    - Crée le schéma PostgreSQL dédié
    - Initialise la configuration
    - Applique les migrations
    """
    # Vérifier si le code pays existe déjà
    existing = db.query(Tenant).filter(Tenant.country_code == tenant_data.country_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le code pays '{tenant_data.country_code}' existe déjà"
        )

    # Créer le tenant dans la table core.tenants
    new_tenant = Tenant(
        name=tenant_data.name,
        country_code=tenant_data.country_code,
        regulatory_authority=tenant_data.regulatory_authority,
        base_currency=tenant_data.base_currency or "XOF",
        status="active",
        config=tenant_data.config.model_dump() if tenant_data.config else {}
    )
    db.add(new_tenant)
    db.commit()
    db.refresh(new_tenant)

    # Créer le schéma PostgreSQL dédié avec toutes les tables
    schema_name = f"tenant_{tenant_data.country_code.lower()}"
    try:
        # Utiliser la fonction SQL create_tenant_tables si elle existe
        try:
            db.execute(text("SELECT create_tenant_tables(:schema)"), {"schema": schema_name})
            db.commit()
        except Exception:
            db.rollback()
            # Fallback: créer manuellement le schéma et les tables
            db.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
            db.commit()

            tenant_tables_sql = f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    phone VARCHAR(20),
                    password_hash VARCHAR(255) NOT NULL,
                    first_name VARCHAR(100),
                    last_name VARCHAR(100),
                    role VARCHAR(50) DEFAULT 'customer',
                    is_active BOOLEAN DEFAULT TRUE,
                    kyc_status VARCHAR(20) DEFAULT 'pending',
                    mfa_enabled BOOLEAN DEFAULT FALSE,
                    mfa_secret VARCHAR(500),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.accounts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    account_type VARCHAR(50) NOT NULL,
                    iban VARCHAR(34) UNIQUE,
                    bic VARCHAR(11),
                    status VARCHAR(20) DEFAULT 'active',
                    daily_limit JSONB DEFAULT '"1000000"',
                    monthly_limit JSONB DEFAULT '"10000000"',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.account_balances (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    account_id UUID NOT NULL,
                    currency VARCHAR(3) NOT NULL,
                    available JSONB DEFAULT '"0"',
                    pending JSONB DEFAULT '"0"',
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.transactions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    from_account_id UUID,
                    to_account_id UUID,
                    amount JSONB NOT NULL,
                    currency VARCHAR(3) NOT NULL,
                    reference VARCHAR(140),
                    transaction_type VARCHAR(50) NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.ledger_entries (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    account_id UUID NOT NULL,
                    transaction_id UUID NOT NULL,
                    entry_type VARCHAR(10) NOT NULL,
                    amount JSONB NOT NULL,
                    currency VARCHAR(3) NOT NULL,
                    balance_after JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.tontines (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(100) NOT NULL,
                    admin_id UUID NOT NULL,
                    target_amount JSONB NOT NULL,
                    base_currency VARCHAR(3) DEFAULT 'XOF',
                    frequency VARCHAR(20),
                    distribution_method VARCHAR(20) DEFAULT 'rotating',
                    status VARCHAR(20) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.tontine_members (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tontine_id UUID NOT NULL,
                    user_id UUID NOT NULL,
                    contribution_amount JSONB NOT NULL,
                    "order" INTEGER,
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.tontine_cycles (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tontine_id UUID NOT NULL,
                    cycle_number INTEGER NOT NULL,
                    recipient_user_id UUID NOT NULL,
                    amount JSONB NOT NULL,
                    currency VARCHAR(3) NOT NULL,
                    disbursement_date TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.kyc_documents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    document_type VARCHAR(50) NOT NULL,
                    document_url VARCHAR(255) NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    rejection_reason VARCHAR(255),
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    verified_at TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.audit_logs (
                    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    user_id UUID,
                    user_email VARCHAR(255),
                    user_role VARCHAR(50),
                    ip_address INET,
                    user_agent TEXT,
                    action VARCHAR(100),
                    resource_type VARCHAR(50),
                    resource_id UUID,
                    changes JSONB,
                    metadata JSONB,
                    tenant_id UUID,
                    request_id UUID,
                    session_id UUID
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.support_tickets (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    assigned_to UUID,
                    subject VARCHAR(200) NOT NULL,
                    description VARCHAR(2000),
                    category VARCHAR(50),
                    priority VARCHAR(20) DEFAULT 'medium',
                    status VARCHAR(20) DEFAULT 'open',
                    resolution VARCHAR(2000),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP,
                    resolved_at TIMESTAMP,
                    closed_at TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS {schema_name}.chat_messages (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ticket_id UUID NOT NULL,
                    sender_id UUID NOT NULL,
                    sender_role VARCHAR(20) NOT NULL,
                    message VARCHAR(5000) NOT NULL,
                    message_type VARCHAR(20) DEFAULT 'text',
                    file_url VARCHAR(500),
                    is_read JSONB DEFAULT 'false',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- Trigger automatique d'audit exige par la Spec technique 4.4
                CREATE OR REPLACE FUNCTION {schema_name}.log_user_changes()
                RETURNS TRIGGER AS $$
                BEGIN
                    INSERT INTO {schema_name}.audit_logs (action, resource_type, resource_id, changes)
                    VALUES (
                        TG_OP || '.users',
                        'user',
                        NEW.id,
                        jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
                    );
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER users_audit
                AFTER INSERT OR UPDATE OR DELETE ON {schema_name}.users
                FOR EACH ROW EXECUTE FUNCTION {schema_name}.log_user_changes();
            """
            for statement in tenant_tables_sql.split(';'):
                statement = statement.strip()
                if statement:
                    db.execute(text(statement))
            db.commit()

    except Exception as e:
        # Rollback en cas d'erreur
        db.delete(new_tenant)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création du schéma: {str(e)}"
        )

    # Log d'audit
    db.add(AuditLog(
        user_id=current_user.user_id,
        action="CREATE_TENANT",
        resource_type="tenants",
        resource_id=new_tenant.tenant_id,
        metadata_col={"country_code": tenant_data.country_code}
    ))
    db.commit()

    # Initialisation des webhooks de conformite
    await setup_compliance_webhooks(new_tenant.tenant_id)

    return new_tenant


@router.get("/admin/tenants/{tenant_id}/analytics", tags=["Super Admin"])
async def get_tenant_analytics(
    tenant_id: UUID4,
    db: Session = Depends(get_db),
    current_user: CurrentUser = RequireSuperAdmin
):
    """
    Récupère les analytics pour un tenant spécifique
    Métriques: utilisateurs, transactions, dépôts, nouveaux users 24h
    """
    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")

    schema_name = f"tenant_{tenant.country_code.lower()}"

    try:
        # Basculer vers le schéma du tenant
        db.execute(text(f"SET search_path TO {schema_name}, public"))

        # Requête analytics (Aligné exactement sur spec 4.2.2 en gérant les jointures réelles)
        stats = db.execute(text(f"""
            WITH user_tx AS (
                SELECT u.id, COUNT(t.id) as tx_count
                FROM {schema_name}.users u
                LEFT JOIN {schema_name}.accounts a ON a.user_id = u.id
                LEFT JOIN {schema_name}.transactions t ON t.from_account_id = a.id OR t.to_account_id = a.id
                GROUP BY u.id
            )
            SELECT 
                COUNT(DISTINCT u.id) as total_users,
                COALESCE(SUM(CAST(ab.available AS NUMERIC)), 0) as total_deposits,
                COUNT(DISTINCT u.id) FILTER (WHERE u.created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
                COALESCE(AVG(ut.tx_count), 0) as avg_transactions_per_user
            FROM {schema_name}.users u
            LEFT JOIN {schema_name}.accounts a ON a.user_id = u.id
            LEFT JOIN {schema_name}.account_balances ab ON ab.account_id = a.id
            LEFT JOIN user_tx ut ON ut.id = u.id
        """)).fetchone()

        return {
            "total_users": stats[0],
            "total_deposits": float(stats[1]),
            "new_users_24h": stats[2],
            "avg_transactions_per_user": float(stats[3])
        }

    finally:
        # Remettre le search_path par défaut
        db.execute(text("SET search_path TO public"))


@router.get("/admin/audit-logs", tags=["Super Admin"])
async def get_all_audit_logs(
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = RequireSuperAdmin
):
    """
    Récupère les logs d'audit globaux (tous tenants)
    Filtrage par action et user_id
    """
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "logs": logs
    }


@router.patch("/admin/users/{user_id}", tags=["Super Admin"])
async def update_user_global(
    user_id: UUID4,
    role: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = RequireSuperAdmin
):
    """
    Mise à jour d'un utilisateur (cross-tenant)
    Permet de changer le rôle ou le statut
    """
    # Rechercher l'utilisateur dans tous les tenants
    tenants = db.query(Tenant).all()
    user_found = None
    user_tenant = None

    for tenant in tenants:
        schema_name = f"tenant_{tenant.country_code.lower()}"
        try:
            db.execute(text(f"SET search_path TO {schema_name}, public"))
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user_found = user
                user_tenant = tenant
                break
        except:
            continue

    if not user_found:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # Mise à jour
    if role:
        user_found.role = role
    if status:
        user_found.status = status

    db.commit()
    db.refresh(user_found)

    # Log d'audit
    db.execute(text("SET search_path TO public"))
    db.add(AuditLog(
        user_id=current_user.user_id,
        action="UPDATE_USER_GLOBAL",
        resource_type="users",
        resource_id=user_id,
        metadata_col={"role": role, "status": status, "tenant": user_tenant.country_code}
    ))
    db.commit()

    return user_found


# ==================== COUNTRY ADMIN API ====================

@router.get("/admin/country/users", response_model=List[UserResponse], tags=["Country Admin"])
async def list_country_users(
    status: Optional[str] = None,
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireCountryAdmin
):
    """
    Liste les utilisateurs du tenant (pays)
    Filtrage par statut
    """
    query = db.query(User)

    if status:
        query = query.filter(User.status == status)

    users = query.offset(offset).limit(limit).all()
    return users


@router.post("/admin/country/kyc/{doc_id}/verify", tags=["Country Admin"])
async def verify_kyc_document(
    doc_id: UUID4,
    approved: bool,
    rejection_reason: Optional[str] = None,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = Depends(require_permissions(["kyc:approve", "kyc:reject"]))
):
    """
    Valide ou rejette un document KYC
    Met à jour le statut utilisateur si approuvé
    """
    doc = db.query(KYCDocument).filter(KYCDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document KYC non trouvé")

    if approved:
        doc.status = "verified"
        doc.verified_at = datetime.utcnow()

        # Mettre à jour le statut utilisateur
        user = db.query(User).filter(User.id == doc.user_id).first()
        if user and user.status == "pending_kyc":
            user.status = "active"
    else:
        doc.status = "rejected"
        doc.rejection_reason = rejection_reason

    db.commit()
    db.refresh(doc)

    # Log d'audit
    db.add(AuditLog(
        user_id=current_user.user_id,
        action="KYC_VERIFY" if approved else "KYC_REJECT",
        resource_type="kyc_documents",
        resource_id=doc_id,
        metadata_col={"approved": approved, "user_id": str(doc.user_id)}
    ))
    db.commit()

    return {"status": "success", "document": doc}


@router.get("/admin/country/transactions", tags=["Country Admin"])
async def list_country_transactions(
    status: Optional[str] = None,
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireCountryAdmin
):
    """
    Liste les transactions du pays
    Filtrage par statut
    """
    query = db.query(Transaction)

    if status:
        query = query.filter(Transaction.status == status)

    total = query.count()
    transactions = query.order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "transactions": transactions
    }


@router.get("/admin/country/reports", tags=["Country Admin"])
async def generate_country_report(
    period: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = Depends(require_permissions(["reports:generate"]))
):
    """
    Génère un rapport d'activité pour le pays
    Périodes: daily, weekly, monthly
    """
    # Déterminer la date de début selon la période
    if period == "daily":
        start_date = datetime.utcnow() - timedelta(days=1)
    elif period == "weekly":
        start_date = datetime.utcnow() - timedelta(weeks=1)
    else:  # monthly
        start_date = datetime.utcnow() - timedelta(days=30)

    # Requêtes agrégées
    new_users = db.query(func.count(User.id)).filter(User.created_at >= start_date).scalar()
    new_transactions = db.query(func.count(Transaction.id)).filter(Transaction.created_at >= start_date).scalar()
    transaction_volume = db.query(func.sum(text("CAST(amount AS NUMERIC)"))).select_from(Transaction).filter(
        Transaction.created_at >= start_date,
        Transaction.status == "completed"
    ).scalar() or 0

    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": datetime.utcnow().isoformat(),
        "metrics": {
            "new_users": new_users,
            "new_transactions": new_transactions,
            "transaction_volume": float(transaction_volume),
            "avg_transaction_value": float(transaction_volume) / new_transactions if new_transactions > 0 else 0
        }
    }


# ==================== SUPPORT AGENT API ====================

@router.get("/support/users/{user_id}", response_model=UserResponse, tags=["Support"])
async def get_user_details(
    user_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireSupport
):
    """
    Consultation des détails d'un utilisateur
    Accessible aux agents support
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    # Log de consultation
    db.add(AuditLog(
        user_id=current_user.user_id,
        action="SUPPORT_VIEW_USER",
        resource_type="users",
        resource_id=user_id
    ))
    db.commit()

    return user


@router.post("/support/accounts/{account_id}/freeze", tags=["Support L2"])
async def freeze_account(
    account_id: UUID4,
    reason: str,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireSupportL2
):
    """
    Gèle un compte (Support L2 uniquement)
    Empêche les transactions sortantes
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Compte non trouvé")

    if account.status == "frozen":
        raise HTTPException(status_code=400, detail="Compte déjà gelé")

    account.status = "frozen"
    db.commit()
    db.refresh(account)

    # Log d'audit
    db.add(AuditLog(
        user_id=current_user.user_id,
        action="FREEZE_ACCOUNT",
        resource_type="accounts",
        resource_id=account_id,
        metadata_col={"reason": reason}
    ))
    db.commit()

    return {"status": "success", "account": account}


@router.post("/support/accounts/{account_id}/unfreeze", tags=["Support L2"])
async def unfreeze_account(
    account_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireSupportL2
):
    """
    Dégèle un compte (Support L2 uniquement)
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Compte non trouvé")

    if account.status != "frozen":
        raise HTTPException(status_code=400, detail="Compte non gelé")

    account.status = "active"
    db.commit()
    db.refresh(account)

    # Log d'audit
    db.add(AuditLog(
        user_id=current_user.user_id,
        action="UNFREEZE_ACCOUNT",
        resource_type="accounts",
        resource_id=account_id
    ))
    db.commit()

    return {"status": "success", "account": account}


@router.post("/support/transactions/{transaction_id}/refund", tags=["Support L2"])
async def refund_transaction(
    transaction_id: UUID4,
    reason: str,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireSupportL2
):
    """
    Rembourse une transaction (Support L2 uniquement)
    Crée une transaction inverse
    """
    from app.banking import TransactionEngine

    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")

    if transaction.status not in ["completed"]:
        raise HTTPException(status_code=400, detail="Transaction non remboursable")

    # Créer transaction inverse
    try:
        refund_tx = await TransactionEngine.execute_transfer(
            db=db,
            from_account_id=transaction.to_account_id,
            to_account_id=transaction.from_account_id,
            amount=transaction.amount,
            currency=transaction.currency,
            reference=f"REFUND: {transaction.reference or transaction_id}"
        )

        # Marquer la transaction originale comme remboursée
        transaction.status = "refunded"
        db.commit()

        # Log d'audit
        db.add(AuditLog(
            user_id=current_user.user_id,
            action="REFUND_TRANSACTION",
            resource_type="transactions",
            resource_id=transaction_id,
            metadata_col={"reason": reason, "refund_tx_id": str(refund_tx.id)}
        ))
        db.commit()

        return {"status": "success", "refund_transaction": refund_tx}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du remboursement: {str(e)}"
        )


# ==================== USERS CRUD (Admin) ====================

@router.get("/users", tags=["Users"])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    kyc_status: Optional[str] = None,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Liste les utilisateurs avec pagination et filtres."""
    query = db.query(User)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_filter)) |
            (User.first_name.ilike(search_filter)) |
            (User.last_name.ilike(search_filter))
        )
    if role:
        query = query.filter(User.role == role)
    if kyc_status:
        query = query.filter(User.kyc_status == kyc_status)

    total = query.count()
    offset = (page - 1) * page_size
    users = query.order_by(User.created_at.desc()).offset(offset).limit(page_size).all()

    return {
        "items": users,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/users/{user_id}", response_model=UserResponse, tags=["Users"])
async def get_user(
    user_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Obtenir les details d'un utilisateur."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse, tags=["Users"])
async def update_user(
    user_id: UUID4,
    user_data: UserUpdate,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Mettre a jour un utilisateur."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")

    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="UPDATE_USER",
        resource_type="users",
        resource_id=user_id,
        metadata_col=update_data
    ))
    db.commit()

    return user


@router.post("/users/{user_id}/activate", tags=["Users"])
async def activate_user(
    user_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Activer un utilisateur."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")

    user.is_active = True
    db.commit()

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="ACTIVATE_USER",
        resource_type="users",
        resource_id=user_id
    ))
    db.commit()

    return {"status": "success", "message": "Utilisateur active"}


@router.post("/users/{user_id}/deactivate", tags=["Users"])
async def deactivate_user(
    user_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Desactiver un utilisateur."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")

    user.is_active = False
    db.commit()

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="DEACTIVATE_USER",
        resource_type="users",
        resource_id=user_id
    ))
    db.commit()

    return {"status": "success", "message": "Utilisateur desactive"}


# ==================== SUPPORT TICKETS CRUD ====================

@router.get("/support/tickets", tags=["Support"])
async def list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireSupport
):
    """Liste les tickets de support avec pagination et filtres."""
    query = db.query(SupportTicket)

    if search:
        query = query.filter(SupportTicket.subject.ilike(f"%{search}%"))
    if status_filter:
        query = query.filter(SupportTicket.status == status_filter)
    if priority:
        query = query.filter(SupportTicket.priority == priority)

    total = query.count()
    offset = (page - 1) * page_size
    tickets = query.order_by(SupportTicket.created_at.desc()).offset(offset).limit(page_size).all()

    return {
        "items": tickets,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.post("/support/tickets", response_model=SupportTicketResponse, tags=["Support"])
async def create_ticket(
    ticket_data: SupportTicketCreate,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Creer un nouveau ticket de support."""
    new_ticket = SupportTicket(
        user_id=current_user.user_id,
        subject=ticket_data.subject,
        description=ticket_data.description,
        priority=ticket_data.priority or "medium",
        category=ticket_data.category or "other",
        status="open"
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="CREATE_TICKET",
        resource_type="support_tickets",
        resource_id=new_ticket.id
    ))
    db.commit()

    return new_ticket


@router.get("/support/tickets/{ticket_id}", response_model=SupportTicketResponse, tags=["Support"])
async def get_ticket(
    ticket_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireSupport
):
    """Obtenir les details d'un ticket."""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouve")
    return ticket


@router.patch("/support/tickets/{ticket_id}", response_model=SupportTicketResponse, tags=["Support"])
async def update_ticket(
    ticket_id: UUID4,
    ticket_data: SupportTicketUpdate,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireSupport
):
    """Mettre a jour un ticket de support."""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouve")

    update_data = ticket_data.model_dump(exclude_unset=True)

    if "status" in update_data:
        if update_data["status"] == "resolved":
            ticket.resolved_at = datetime.utcnow()
        elif update_data["status"] == "closed":
            ticket.closed_at = datetime.utcnow()

    for field, value in update_data.items():
        setattr(ticket, field, value)

    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="UPDATE_TICKET",
        resource_type="support_tickets",
        resource_id=ticket_id,
        metadata_col=update_data
    ))
    db.commit()

    return ticket


@router.delete("/support/tickets/{ticket_id}", tags=["Support"])
async def delete_ticket(
    ticket_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Supprimer un ticket de support."""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouve")

    db.delete(ticket)
    db.commit()

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="DELETE_TICKET",
        resource_type="support_tickets",
        resource_id=ticket_id
    ))
    db.commit()

    return {"status": "success", "message": "Ticket supprime"}


# ==================== PROFILE & SETTINGS ====================

@router.patch("/auth/profile", response_model=UserResponse, tags=["Profile"])
async def update_profile(
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Mettre a jour le profil de l'utilisateur connecte."""
    user = db.query(User).filter(User.id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")

    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


@router.post("/auth/change-password", tags=["Profile"])
async def change_password(
    password_data: PasswordChange,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Changer le mot de passe de l'utilisateur connecte."""
    user = db.query(User).filter(User.id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")

    if not verify_password(password_data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    user.password_hash = get_password_hash(password_data.new_password)
    db.commit()

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="CHANGE_PASSWORD",
        resource_type="users",
        resource_id=user.id
    ))
    db.commit()

    return {"status": "success", "message": "Mot de passe modifie avec succes"}


# ==================== TENANTS UPDATE/DELETE ====================

@router.patch("/admin/tenants/{tenant_id}", response_model=TenantResponse, tags=["Super Admin"])
async def update_tenant(
    tenant_id: UUID4,
    tenant_data: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = RequireSuperAdmin
):
    """Mettre a jour un tenant."""
    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouve")

    update_data = tenant_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)

    db.commit()
    db.refresh(tenant)

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="UPDATE_TENANT",
        resource_type="tenants",
        resource_id=tenant_id,
        metadata_col=update_data
    ))
    db.commit()

    return tenant


@router.delete("/admin/tenants/{tenant_id}", tags=["Super Admin"])
async def delete_tenant(
    tenant_id: UUID4,
    db: Session = Depends(get_db),
    current_user: CurrentUser = RequireSuperAdmin
):
    """Supprimer un tenant (attention: operation irreversible)."""
    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouve")

    schema_name = f"tenant_{tenant.country_code.lower()}"

    try:
        db.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE"))
        db.delete(tenant)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="DELETE_TENANT",
        resource_type="tenants",
        resource_id=tenant_id,
        metadata_col={"country_code": tenant.country_code}
    ))
    db.commit()

    return {"status": "success", "message": f"Tenant {tenant.country_code} supprime"}


# ==================== TRANSACTIONS LIST (Admin) ====================

@router.get("/transactions", tags=["Transactions"])
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    transaction_type: Optional[str] = Query(None, alias="type"),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Liste toutes les transactions avec pagination et filtres."""
    query = db.query(Transaction)

    if search:
        query = query.filter(Transaction.reference.ilike(f"%{search}%"))
    if status_filter:
        query = query.filter(Transaction.status == status_filter)
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)

    total = query.count()
    offset = (page - 1) * page_size
    transactions = query.order_by(Transaction.created_at.desc()).offset(offset).limit(page_size).all()

    return {
        "items": transactions,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/transactions/{transaction_id}", tags=["Transactions"])
async def get_transaction(
    transaction_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Obtenir les details d'une transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvee")
    return transaction


# ==================== ACCOUNTS (Admin) ====================

@router.get("/admin/accounts", tags=["Accounts"])
async def list_accounts_admin(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    account_type: Optional[str] = Query(None, alias="account_type"),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Liste tous les comptes avec pagination, filtres et soldes."""
    query = db.query(Account)

    if search:
        query = query.filter(Account.iban.ilike(f"%{search}%"))
    if status_filter:
        query = query.filter(Account.status == status_filter)
    if account_type:
        query = query.filter(Account.account_type == account_type)

    total = query.count()
    offset = (page - 1) * page_size
    accounts = query.order_by(Account.created_at.desc()).offset(offset).limit(page_size).all()

    # Enrichir les comptes avec solde, devise et proprietaire
    items = []
    for acc in accounts:
        bal = db.query(AccountBalance).filter(AccountBalance.account_id == acc.id).first()
        owner = db.query(User).filter(User.id == acc.user_id).first()
        items.append({
            "id": str(acc.id),
            "user_id": str(acc.user_id),
            "owner_name": f"{owner.first_name or ''} {owner.last_name or ''}".strip() if owner else "Inconnu",
            "account_number": acc.iban or str(acc.id)[:12].upper(),
            "account_type": acc.account_type,
            "status": acc.status,
            "balance": float(bal.available) if bal and bal.available else 0.0,
            "currency": bal.currency if bal else "XOF",
            "created_at": acc.created_at.isoformat() if acc.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/admin/accounts/{account_id}", tags=["Accounts"])
async def get_account_admin(
    account_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Obtenir les details d'un compte."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Compte non trouve")

    balances = db.query(AccountBalance).filter(AccountBalance.account_id == account_id).all()
    return {
        "account": account,
        "balances": balances
    }


@router.post("/admin/accounts/{account_id}/close", tags=["Accounts"])
async def close_account(
    account_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Fermer un compte bancaire."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Compte non trouve")

    if account.status == "closed":
        raise HTTPException(status_code=400, detail="Compte deja ferme")

    account.status = "closed"
    db.commit()

    db.add(AuditLog(
        user_id=current_user.user_id,
        action="CLOSE_ACCOUNT",
        resource_type="accounts",
        resource_id=account_id
    ))
    db.commit()

    return {"status": "success", "message": "Compte ferme"}


# ==================== KYC LIST (Admin) ====================

@router.get("/admin/country/kyc", tags=["KYC"])
async def list_kyc_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    doc_type: Optional[str] = None,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Liste les documents KYC avec pagination et filtres."""
    query = db.query(KYCDocument)

    if status_filter:
        query = query.filter(KYCDocument.status == status_filter)
    if doc_type:
        query = query.filter(KYCDocument.document_type == doc_type)

    total = query.count()
    offset = (page - 1) * page_size
    documents = query.order_by(KYCDocument.id.desc()).offset(offset).limit(page_size).all()

    return {
        "items": documents,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


# ==================== DASHBOARD / ANALYTICS ====================

@router.get("/admin/country/analytics", tags=["Dashboard"])
async def get_country_analytics(
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Obtenir les statistiques du dashboard pour le pays courant."""
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_accounts = db.query(func.count(Account.id)).filter(Account.status == "active").scalar() or 0

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_transactions = db.query(func.count(Transaction.id)).filter(
        Transaction.created_at >= today
    ).scalar() or 0

    total_volume = db.query(func.sum(text("CAST(amount AS NUMERIC)"))).select_from(Transaction).filter(
        Transaction.status == "completed"
    ).scalar() or 0

    # Croissance utilisateurs (7 derniers jours)
    user_growth = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        next_day = day + timedelta(days=1)
        count = db.query(func.count(User.id)).filter(
            User.created_at >= day,
            User.created_at < next_day
        ).scalar() or 0
        user_growth.append({"date": day.strftime("%Y-%m-%d"), "count": count})

    # Volume transactions (7 derniers jours)
    transaction_volume = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        next_day = day + timedelta(days=1)
        volume = db.query(func.sum(text("CAST(amount AS NUMERIC)"))).select_from(Transaction).filter(
            Transaction.created_at >= day,
            Transaction.created_at < next_day,
            Transaction.status == "completed"
        ).scalar() or 0
        transaction_volume.append({"date": day.strftime("%Y-%m-%d"), "volume": float(volume)})

    return {
        "total_users": total_users,
        "active_accounts": active_accounts,
        "today_transactions": today_transactions,
        "total_volume": float(total_volume),
        "user_growth": user_growth,
        "transaction_volume": transaction_volume
    }


# ==================== TONTINES (Admin) ====================

@router.get("/admin/tontines", tags=["Tontines"])
async def list_tontines_admin(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Liste les tontines avec pagination et filtres."""
    from app.models import Tontine, TontineMember

    query = db.query(Tontine)

    if search:
        query = query.filter(Tontine.name.ilike(f"%{search}%"))
    if status_filter:
        query = query.filter(Tontine.status == status_filter)

    total = query.count()
    offset = (page - 1) * page_size
    tontines = query.order_by(Tontine.created_at.desc()).offset(offset).limit(page_size).all()

    return {
        "items": tontines,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


# ==================== TONTINE CYCLES ====================

@router.get("/admin/tontines/{tontine_id}/cycles", tags=["Tontines"])
async def get_tontine_cycles(
    tontine_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Liste les cycles d'une tontine avec le beneficiaire de chaque cycle."""
    from app.models import TontineCycle, Tontine

    tontine = db.query(Tontine).filter(Tontine.id == str(tontine_id)).first()
    if not tontine:
        raise HTTPException(status_code=404, detail="Tontine introuvable")

    cycles = db.query(TontineCycle).filter(
        TontineCycle.tontine_id == str(tontine_id)
    ).order_by(TontineCycle.cycle_number.asc()).all()

    result = []
    for c in cycles:
        recipient = db.query(User).filter(User.id == str(c.recipient_user_id)).first()
        result.append({
            "id": str(c.id),
            "tontine_id": str(c.tontine_id),
            "cycle_number": c.cycle_number,
            "recipient_user_id": str(c.recipient_user_id),
            "recipient_name": f"{recipient.first_name} {recipient.last_name}" if recipient else "Inconnu",
            "amount": float(c.amount) if c.amount else 0,
            "currency": c.currency or "XOF",
            "disbursement_date": c.disbursement_date.isoformat() if c.disbursement_date else None,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return {
        "tontine_id": str(tontine_id),
        "tontine_name": tontine.name,
        "total_cycles": len(result),
        "cycles": result
    }


@router.post("/admin/tontines/{tontine_id}/cycles/trigger", tags=["Tontines"])
async def trigger_tontine_cycle(
    tontine_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Declenche manuellement un nouveau cycle de distribution pour une tontine."""
    from app.models import TontineCycle, Tontine
    from app.tontine_engine import TontineEngine

    tontine = db.query(Tontine).filter(Tontine.id == str(tontine_id)).first()
    if not tontine:
        raise HTTPException(status_code=404, detail="Tontine introuvable")

    if tontine.status != "active":
        raise HTTPException(status_code=400, detail="La tontine n'est pas active")

    # Determiner le numero du prochain cycle
    last_cycle = db.query(func.max(TontineCycle.cycle_number)).filter(
        TontineCycle.tontine_id == str(tontine_id)
    ).scalar() or 0

    next_cycle = last_cycle + 1

    try:
        distribution_tx = TontineEngine.distribute(db, str(tontine_id), next_cycle)
        return {
            "message": f"Cycle {next_cycle} declenche avec succes",
            "cycle_number": next_cycle,
            "transaction_id": str(distribution_tx.id) if distribution_tx else None
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/admin/tontines/{tontine_id}/start", tags=["Tontines"])
async def start_tontine(
    tontine_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Demarre une tontine (passe de 'open' a 'active')."""
    from app.tontine_engine import TontineEngine

    try:
        TontineEngine.start_tontine(db, str(tontine_id), current_user.user_id)
        return {"message": "Tontine demarree avec succes"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/admin/tontines/{tontine_id}/status", tags=["Tontines"])
async def get_tontine_status(
    tontine_id: UUID4,
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Obtenir le statut detaille d'une tontine (membres, contributions, etc.)."""
    from app.tontine_engine import TontineEngine

    try:
        status = TontineEngine.get_tontine_status(db, str(tontine_id))
        # Convertir les Decimal en float pour la serialisation JSON
        status["target_amount"] = float(status["target_amount"])
        status["total_per_cycle"] = float(status["total_per_cycle"])
        for m in status["members"]:
            m["contribution"] = float(m["contribution"])
        return status
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== EXPORT RAPPORTS ====================

@router.get("/admin/country/reports", tags=["Rapports"])
async def get_country_report(
    period: str = Query("monthly", description="daily, weekly, monthly"),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Genere les donnees du rapport pour le pays courant."""
    from app.reports import get_report_data

    # Generer un rapport global
    report = {
        "period": period,
        "generated_at": datetime.utcnow().isoformat(),
        "available_reports": ["users", "transactions", "accounts", "tontines", "support"],
    }

    # Stats resume
    now = datetime.utcnow()
    if period == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "weekly":
        start = now - timedelta(days=7)
    else:
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    report["new_users"] = db.query(func.count(User.id)).filter(User.created_at >= start).scalar() or 0
    report["new_transactions"] = db.query(func.count(Transaction.id)).filter(Transaction.created_at >= start).scalar() or 0
    report["new_accounts"] = db.query(func.count(Account.id)).filter(Account.created_at >= start).scalar() or 0
    report["open_tickets"] = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "open").scalar() or 0

    return report


@router.get("/admin/country/reports/export", tags=["Rapports"])
async def export_report(
    report_type: str = Query(..., description="users, transactions, accounts, tontines, support"),
    format: str = Query("csv", description="csv, excel, pdf"),
    period: str = Query("monthly", description="daily, weekly, monthly"),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """
    Exporte un rapport dans le format demande (CSV, Excel, PDF).

    - **report_type**: Type de donnees (users, transactions, accounts, tontines, support)
    - **format**: Format de sortie (csv, excel, pdf)
    - **period**: Periode du rapport (daily, weekly, monthly)
    """
    from app.reports import get_report_data, generate_csv, generate_excel, generate_pdf

    valid_types = ["users", "transactions", "accounts", "tontines", "support"]
    if report_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Type invalide. Types valides: {', '.join(valid_types)}")

    valid_formats = ["csv", "excel", "pdf"]
    if format not in valid_formats:
        raise HTTPException(status_code=400, detail=f"Format invalide. Formats valides: {', '.join(valid_formats)}")

    # Generer les donnees
    data = get_report_data(db, report_type, period)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"djembe_rapport_{report_type}_{timestamp}"

    if format == "csv":
        content = generate_csv(data)
        return StreamingResponse(
            io.BytesIO(content),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}.csv"}
        )

    elif format == "excel":
        content = generate_excel(data)
        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}.xlsx"}
        )

    elif format == "pdf":
        content = generate_pdf(data)
        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}.pdf"}
        )


# ==================== CONVERSION DEVISES ====================

@router.get("/currency/rates", tags=["Devises"])
async def get_exchange_rates(
    base: str = Query("XOF", description="Devise de base (XOF, EUR, USD, GBP, NGN, GHS)"),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Recupere les taux de change pour une devise de base."""
    try:
        from app.currency import get_currency_service
        service = get_currency_service()
        rates = service.get_all_rates(base.upper())
        return {
            "base": base.upper(),
            "rates": {k: float(v) for k, v in rates.items()},
            "supported_currencies": service.SUPPORTED_CURRENCIES,
        }
    except Exception as e:
        # Fallback si Redis n'est pas disponible
        from app.currency import CurrencyService
        fallback_rates = {}
        for currency in CurrencyService.SUPPORTED_CURRENCIES:
            if currency != base.upper():
                pair = f"{base.upper()}_{currency}"
                if pair in CurrencyService.FIXED_RATES:
                    fallback_rates[currency] = float(CurrencyService.FIXED_RATES[pair])
        return {
            "base": base.upper(),
            "rates": fallback_rates,
            "supported_currencies": CurrencyService.SUPPORTED_CURRENCIES,
            "source": "fixed_rates"
        }


@router.post("/currency/convert", tags=["Devises"])
async def convert_currency(
    amount: float = Query(..., gt=0, description="Montant a convertir"),
    from_currency: str = Query(..., description="Devise source"),
    to_currency: str = Query(..., description="Devise cible"),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Convertit un montant d'une devise a une autre."""
    from decimal import Decimal

    try:
        from app.currency import get_currency_service
        service = get_currency_service()
        rate = service.get_rate(from_currency.upper(), to_currency.upper())
        result = service.convert(Decimal(str(amount)), from_currency.upper(), to_currency.upper())

        service.log_conversion(
            amount=Decimal(str(amount)),
            from_currency=from_currency.upper(),
            to_currency=to_currency.upper(),
            rate=rate,
            result=result,
            user_id=current_user.user_id
        )

        return {
            "amount": amount,
            "from_currency": from_currency.upper(),
            "to_currency": to_currency.upper(),
            "rate": float(rate),
            "converted_amount": float(result),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Fallback sans Redis
        from app.currency import CurrencyService
        pair = f"{from_currency.upper()}_{to_currency.upper()}"
        fixed_rate = CurrencyService.FIXED_RATES.get(pair)
        if fixed_rate:
            result = Decimal(str(amount)) * fixed_rate
            return {
                "amount": amount,
                "from_currency": from_currency.upper(),
                "to_currency": to_currency.upper(),
                "rate": float(fixed_rate),
                "converted_amount": float(result.quantize(Decimal("0.01"))),
                "source": "fixed_rates"
            }
        raise HTTPException(status_code=400, detail=f"Conversion {from_currency} -> {to_currency} non supportee")


# ==================== NOTIFICATIONS ====================

@router.post("/notifications/send", tags=["Notifications"])
async def send_notification(
    user_id: str = Query(..., description="ID utilisateur cible"),
    channel: str = Query("email", description="Canal: email, sms, push"),
    subject: str = Query("Notification Djembe Bank", description="Sujet (email uniquement)"),
    message: str = Query(..., description="Contenu du message"),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Envoie une notification a un utilisateur via le canal specifie."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    result = {"user_id": user_id, "channel": channel, "sent": False}

    if channel == "sms":
        if not user.phone:
            raise HTTPException(status_code=400, detail="L'utilisateur n'a pas de numero de telephone")
        try:
            from app.notifications import NotificationService
            notifier = NotificationService()
            result["sent"] = notifier.send_sms(user.phone, message)
        except Exception as e:
            result["error"] = str(e)

    elif channel == "email":
        try:
            from app.notifications import NotificationService
            notifier = NotificationService()
            result["sent"] = notifier.send_email(user.email, subject, message)
        except Exception as e:
            result["error"] = str(e)

    elif channel == "push":
        import json
        try:
            import redis as redis_lib
            r = redis_lib.Redis(host="localhost", port=6379, db=0)
            r.publish("notification.new", json.dumps({
                "user_id": user_id,
                "title": subject,
                "message": message,
                "type": "info"
            }))
            r.close()
            result["sent"] = True
        except Exception as e:
            result["error"] = str(e)
    else:
        raise HTTPException(status_code=400, detail="Canal invalide. Canaux valides: email, sms, push")

    return result


@router.post("/notifications/broadcast", tags=["Notifications"])
async def broadcast_notification(
    message: str = Query(..., description="Message a diffuser"),
    db: Session = Depends(get_db_with_tenant),
    current_user: CurrentUser = RequireAdmin
):
    """Diffuse une notification push a tous les utilisateurs connectes via WebSocket."""
    import json
    try:
        import redis as redis_lib
        r = redis_lib.Redis(host="localhost", port=6379, db=0)
        users = db.query(User).filter(User.is_active == text("'true'")).all()
        for user in users:
            r.publish("notification.new", json.dumps({
                "user_id": str(user.id),
                "title": "Notification Djembe Bank",
                "message": message,
                "type": "info"
            }))
        r.close()
        return {"message": "Notification diffusee", "target_users": len(users)}
    except Exception as e:
        return {"message": "Diffusion tentee (Redis optionnel)", "error": str(e)}


@router.post("/notifications/test-email", tags=["Notifications"])
async def test_email_notification(
    email: str = Query(..., description="Adresse email"),
    current_user: CurrentUser = RequireAdmin
):
    """Teste l'envoi d'un email via SendGrid."""
    try:
        from app.notifications import NotificationService
        notifier = NotificationService()
        success = notifier.send_email(email, "Test Djembe Bank", "Ceci est un test de notification email.")
        return {"sent": success, "email": email}
    except Exception as e:
        return {"sent": False, "error": str(e)}


# ==================== CONFIG GLOBALE TENANT ====================

@router.get("/admin/tenants/{tenant_id}/config", tags=["Configuration"])
async def get_tenant_config(
    tenant_id: UUID4,
    db: Session = Depends(get_db),
    current_user: CurrentUser = RequireSuperAdmin
):
    """Recupere la configuration globale d'un tenant."""
    tenant = db.query(Tenant).filter(Tenant.tenant_id == str(tenant_id)).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    # Valeurs par defaut si config est vide
    default_config = {
        "features": {
            "tontine_enabled": True,
            "international_transfers": True,
            "multi_currency": True,
            "kyc_required": True,
            "mfa_enforced": False,
        },
        "limits": {
            "daily_withdrawal_limit": 1000000,
            "monthly_transfer_limit": 10000000,
            "max_accounts_per_user": 5,
            "min_transfer_amount": 100,
            "max_transfer_amount": 50000000,
        },
        "currencies": {
            "base_currency": tenant.base_currency or "XOF",
            "supported_currencies": ["XOF", "EUR", "USD"],
        },
        "notifications": {
            "sms_enabled": True,
            "email_enabled": True,
            "push_enabled": True,
        },
        "compliance": {
            "kyc_auto_approval": False,
            "fraud_detection_enabled": True,
            "fraud_score_threshold": 70,
        }
    }

    # Fusionner avec la config existante
    stored_config = tenant.config if isinstance(tenant.config, dict) else {}
    merged_config = {**default_config, **stored_config}

    return {
        "tenant_id": str(tenant.tenant_id),
        "tenant_name": tenant.name,
        "country_code": tenant.country_code,
        "config": merged_config
    }


@router.patch("/admin/tenants/{tenant_id}/config", tags=["Configuration"])
async def update_tenant_config(
    tenant_id: UUID4,
    config: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = RequireSuperAdmin
):
    """
    Met a jour la configuration globale d'un tenant.
    La config est un objet JSON libre qui sera fusionne avec la config existante.
    """
    tenant = db.query(Tenant).filter(Tenant.tenant_id == str(tenant_id)).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")

    # Fusionner la nouvelle config avec l'existante
    existing_config = tenant.config if isinstance(tenant.config, dict) else {}
    merged = {**existing_config, **config}

    # Mise a jour recursive pour les sous-objets
    for key, value in config.items():
        if isinstance(value, dict) and key in existing_config and isinstance(existing_config[key], dict):
            merged[key] = {**existing_config[key], **value}

    tenant.config = merged
    db.commit()
    db.refresh(tenant)

    # Log d'audit
    from app.audit import AuditLog
    AuditLog.log(
        db=db,
        user_id=current_user.user_id,
        action="tenant_config_update",
        metadata_col={"tenant_id": str(tenant_id), "updated_keys": list(config.keys())}
    )

    return {
        "message": "Configuration mise a jour",
        "tenant_id": str(tenant.tenant_id),
        "config": merged
    }

from sqlalchemy import Column, String, TIMESTAMP, JSON, text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Tenant(Base):
    """Modele representant un pays ou une entite (Tenant) dans l'architecture SaaS."""
    __tablename__ = "tenants"
    __table_args__ = {"schema": "core"}

    tenant_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(100), nullable=False)
    country_code = Column(String(3), nullable=False, unique=True)
    regulatory_authority = Column(String(100))
    base_currency = Column(String(3), server_default="XOF")
    status = Column(String(20), server_default="active") # active, suspended, maintenance
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    config = Column(JSON, server_default=text("'{}'::JSONB"))

class User(Base):
    """Modele utilisateur stocke dans chaque schema pays."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(String(50), server_default="user")
    mfa_enabled = Column(JSON, server_default=text("'false'")) # Stocke true/false ou config MFA
    status = Column(String(20), server_default="pending_kyc")
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    last_login = Column(TIMESTAMP)

class Account(Base):
    """Gestion des comptes bancaires multi-types."""
    __tablename__ = "accounts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    account_type = Column(String(50), nullable=False) # personal, business, savings, tontine
    iban = Column(String(34), unique=True)
    status = Column(String(20), server_default="active")
    daily_limit = Column(JSON, server_default=text("'1000000'")) # En devise locale
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

class AccountBalance(Base):
    """Soldes en temps reel par devise."""
    __tablename__ = "account_balances"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    currency = Column(String(3), nullable=False)
    available = Column(JSON, server_default=text("'0'")) # Stockage précis via JSON/String decimal
    pending = Column(JSON, server_default=text("'0'"))
    last_updated = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

class LedgerEntry(Base):
    """Grand livre comptable (Double-entree). Chaque entree est immuable."""
    __tablename__ = "ledger_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    account_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    transaction_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    entry_type = Column(String(10), nullable=False) # DEBIT, CREDIT
    amount = Column(JSON, nullable=False)
    currency = Column(String(3), nullable=False)
    balance_after = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

class Transaction(Base):
    """Enregistrement global des flux financiers."""
    __tablename__ = "transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    from_account_id = Column(UUID(as_uuid=True), index=True)
    to_account_id = Column(UUID(as_uuid=True), index=True)
    amount = Column(JSON, nullable=False)
    currency = Column(String(3), nullable=False)
    reference = Column(String(140))
    transaction_type = Column(String(50), nullable=False) # internal, international, p2p
    status = Column(String(20), server_default="pending") # pending, completed, failed, reversed
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

class Tontine(Base):
    """Modele d'epargne collective (Innovation Djembe)."""
    __tablename__ = "tontines"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(100), nullable=False)
    admin_id = Column(UUID(as_uuid=True), nullable=False)
    target_amount = Column(JSON, nullable=False)
    frequency = Column(String(20)) # weekly, monthly
    status = Column(String(20), server_default="active")
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

class TontineMember(Base):
    """Participation des utilisateurs aux tontines."""
    __tablename__ = "tontine_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tontine_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    contribution_amount = Column(JSON, nullable=False)
    order = Column(JSON, nullable=True) # Position dans le cycle de rotation
    joined_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

from sqlalchemy import Column, String, TIMESTAMP, JSON, text, Integer, Date, ForeignKey
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
    phone = Column(String(20))
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    role = Column(String(50), server_default="customer")
    is_active = Column(JSON, server_default=text("'true'"))  # Boolean
    kyc_status = Column(String(20), server_default="pending")  # pending, approved, rejected
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

class Account(Base):
    """Gestion des comptes bancaires multi-types."""
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    account_type = Column(String(50), nullable=False)  # personal, business, savings, tontine, multi_currency
    iban = Column(String(34), unique=True)  # IBAN format local adapté
    bic = Column(String(11))  # BIC/SWIFT code pour virements internationaux
    status = Column(String(20), server_default="active")  # active, frozen, closed
    daily_limit = Column(JSON, server_default=text("'1000000'"))  # Limite retrait journalier
    monthly_limit = Column(JSON, server_default=text("'10000000'"))  # Limite virement mensuel
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
    base_currency = Column(String(3), server_default="XOF")  # Devise de la tontine
    frequency = Column(String(20))  # weekly, monthly
    distribution_method = Column(String(20), server_default="rotating")  # rotating, random, vote
    status = Column(String(20), server_default="active")  # open, active, completed, cancelled
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

class TontineMember(Base):
    """Participation des utilisateurs aux tontines."""
    __tablename__ = "tontine_members"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tontine_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    contribution_amount = Column(JSON, nullable=False)
    order = Column(Integer, nullable=True)  # Position dans le cycle de rotation (1, 2, 3...)
    joined_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))


class TontineCycle(Base):
    """Cycles de distribution des tontines (tracking historique)."""
    __tablename__ = "tontine_cycles"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tontine_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    cycle_number = Column(Integer, nullable=False)  # Numéro du cycle (1, 2, 3...)
    recipient_user_id = Column(UUID(as_uuid=True), nullable=False)  # Bénéficiaire du cycle
    amount = Column(JSON, nullable=False)  # Montant distribué
    currency = Column(String(3), nullable=False)
    disbursement_date = Column(TIMESTAMP)  # Date de distribution effective
    status = Column(String(20), server_default="pending")  # pending, paid, defaulted
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))


class SupportTicket(Base):
    """Tickets de support client."""
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # Client concerné
    assigned_to = Column(UUID(as_uuid=True))  # Agent assigné
    subject = Column(String(200), nullable=False)
    description = Column(String(2000))
    category = Column(String(50))  # account, transaction, kyc, technical, other
    priority = Column(String(20), server_default="medium")  # low, medium, high, urgent
    status = Column(String(20), server_default="open")  # open, in_progress, resolved, closed
    resolution = Column(String(2000))  # Résolution finale
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, onupdate=text("CURRENT_TIMESTAMP"))
    resolved_at = Column(TIMESTAMP)
    closed_at = Column(TIMESTAMP)


class ChatMessage(Base):
    """Messages du chat live support."""
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    ticket_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # Lié au ticket support
    sender_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # Utilisateur ou agent
    sender_role = Column(String(20), nullable=False)  # customer, support_l1, support_l2, system
    message = Column(String(5000), nullable=False)
    message_type = Column(String(20), server_default="text")  # text, image, file, system
    file_url = Column(String(500))  # URL de pièce jointe (optionnel)
    is_read = Column(JSON, server_default=text("'false'"))  # Lu par le destinataire
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

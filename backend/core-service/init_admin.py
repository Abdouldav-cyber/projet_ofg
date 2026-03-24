#!/usr/bin/env python3
"""
Script d'initialisation - Creation du tenant, des tables et de l'utilisateur Super Admin
"""
import sys
import uuid
from sqlalchemy import text
from app.database import SessionLocal


# SQL pour creer toutes les tables dans un schema tenant
TENANT_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS {schema}.users (
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

CREATE TABLE IF NOT EXISTS {schema}.accounts (
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

CREATE TABLE IF NOT EXISTS {schema}.account_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    currency VARCHAR(3) NOT NULL,
    available JSONB DEFAULT '"0"',
    pending JSONB DEFAULT '"0"',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS {schema}.transactions (
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

CREATE TABLE IF NOT EXISTS {schema}.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    transaction_id UUID NOT NULL,
    entry_type VARCHAR(10) NOT NULL,
    amount JSONB NOT NULL,
    currency VARCHAR(3) NOT NULL,
    balance_after JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS {schema}.tontines (
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

CREATE TABLE IF NOT EXISTS {schema}.tontine_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tontine_id UUID NOT NULL,
    user_id UUID NOT NULL,
    contribution_amount JSONB NOT NULL,
    "order" INTEGER,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS {schema}.tontine_cycles (
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

CREATE TABLE IF NOT EXISTS {schema}.kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_url VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    rejection_reason VARCHAR(255),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS {schema}.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    tenant_id VARCHAR(10),
    session_id VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(100),
    before_value JSONB,
    after_value JSONB,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS {schema}.support_tickets (
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

CREATE TABLE IF NOT EXISTS {schema}.chat_messages (
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
"""


def create_tenant_tables(db, tenant_code: str, tenant_name: str):
    """Cree un schema tenant avec toutes les tables necessaires."""
    schema = f"tenant_{tenant_code.lower()}"

    print(f"\n  Schema {schema} ({tenant_name})...")

    # Creer le schema
    db.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
    db.commit()

    # Creer toutes les tables
    sql = TENANT_TABLES_SQL.format(schema=schema)
    for statement in sql.split(';'):
        statement = statement.strip()
        if statement:
            db.execute(text(statement))
    db.commit()
    print(f"    -> Toutes les tables creees dans {schema}")

    return schema


def init_admin():
    db = SessionLocal()

    try:
        print("=" * 60)
        print("Initialisation de la base de donnees Djembe Bank")
        print("=" * 60)

        # 1. Verifier/Creer le tenant Senegal
        print("\n[1] Verification du tenant Senegal...")

        result = db.execute(text("""
            SELECT tenant_id, name, country_code
            FROM core.tenants
            WHERE country_code = 'SN'
        """)).fetchone()

        if result:
            tenant_id = result[0]
            print(f"  Tenant Senegal existe (ID: {tenant_id})")
        else:
            tenant_id = str(uuid.uuid4())
            db.execute(text("""
                INSERT INTO core.tenants (tenant_id, name, country_code, base_currency, status, regulatory_authority)
                VALUES (:id, :name, :code, :currency, :status, :authority)
            """), {
                "id": tenant_id,
                "name": "Senegal",
                "code": "SN",
                "currency": "XOF",
                "status": "active",
                "authority": "BCEAO"
            })
            db.commit()
            print(f"  Tenant Senegal cree (ID: {tenant_id})")

        # 2. Creer les schemas pour tous les tenants existants
        print("\n[2] Creation des schemas et tables pour chaque tenant...")

        tenants = db.execute(text("""
            SELECT country_code, name FROM core.tenants
        """)).fetchall()

        for tenant in tenants:
            create_tenant_tables(db, tenant[0], tenant[1])

        # 3. Creer l'utilisateur Super Admin dans tenant_sn
        print("\n[3] Creation de l'utilisateur Super Admin...")
        tenant_schema = "tenant_sn"
        admin_email = "admin@djembe-bank.com"

        result = db.execute(text(f"""
            SELECT id, email, role
            FROM {tenant_schema}.users
            WHERE email = :email
        """), {"email": admin_email}).fetchone()

        if result:
            print(f"  Admin existe deja (ID: {result[0]})")
            print(f"  Email: {result[1]}, Role: {result[2]}")
        else:
            from app.security import get_password_hash
            password_hash = get_password_hash("SuperAdmin@2025")
            admin_id = str(uuid.uuid4())

            db.execute(text(f"""
                INSERT INTO {tenant_schema}.users
                (id, email, password_hash, first_name, last_name, phone, role, is_active, kyc_status)
                VALUES
                (:id, :email, :password_hash, :first_name, :last_name, :phone, :role, :is_active, :kyc_status)
            """), {
                "id": admin_id,
                "email": admin_email,
                "password_hash": password_hash,
                "first_name": "Super",
                "last_name": "Admin",
                "phone": "+221771234567",
                "role": "super_admin",
                "is_active": True,
                "kyc_status": "approved"
            })
            db.commit()
            print(f"  Super Admin cree (ID: {admin_id})")

        print("\n" + "=" * 60)
        print("INITIALISATION TERMINEE AVEC SUCCES!")
        print("=" * 60)
        print(f"\nIdentifiants de connexion:")
        print(f"  Email:       {admin_email}")
        print(f"  Password:    SuperAdmin@2025")
        print(f"  Code Pays:   SN")
        print(f"\nAcces:")
        print(f"  Frontend:    http://localhost:3000")
        print(f"  API Docs:    http://localhost:8000/docs")
        print("=" * 60 + "\n")

        return True

    except Exception as e:
        print(f"\nERREUR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        db.rollback()
        return False

    finally:
        db.close()


if __name__ == "__main__":
    success = init_admin()
    sys.exit(0 if success else 1)

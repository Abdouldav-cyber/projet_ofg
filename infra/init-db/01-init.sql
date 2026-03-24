-- Initialisation du schema central
CREATE SCHEMA core;

-- Table des Tenants (Pays/Entites)
CREATE TABLE core.tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    country_code VARCHAR(3) NOT NULL UNIQUE, -- ex: SN, CI, NG
    regulatory_authority VARCHAR(100),
    base_currency VARCHAR(3) DEFAULT 'XOF',
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, maintenance
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    config JSONB DEFAULT '{}'::JSONB
);

-- Insertion des pays (Zone UEMOA/BCEAO + autres)
INSERT INTO core.tenants (name, country_code, regulatory_authority, base_currency) VALUES
('Senegal', 'SN', 'BCEAO', 'XOF'),
('Burkina Faso', 'BF', 'BCEAO', 'XOF'),
('Cote d''Ivoire', 'CI', 'BCEAO', 'XOF'),
('Mali', 'ML', 'BCEAO', 'XOF'),
('Niger', 'NE', 'BCEAO', 'XOF'),
('Togo', 'TG', 'BCEAO', 'XOF'),
('Benin', 'BJ', 'BCEAO', 'XOF'),
('Guinee-Bissau', 'GW', 'BCEAO', 'XOF'),
('Nigeria', 'NG', 'Central Bank of Nigeria', 'NGN'),
('Ghana', 'GH', 'Bank of Ghana', 'GHS');

-- Fonction utilitaire pour creer toutes les tables dans un schema tenant
CREATE OR REPLACE FUNCTION create_tenant_tables(schema_name TEXT) RETURNS VOID AS $$
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT ''customer'',
        is_active BOOLEAN DEFAULT TRUE,
        kyc_status VARCHAR(20) DEFAULT ''pending'',
        mfa_enabled BOOLEAN DEFAULT FALSE,
        mfa_secret VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        account_type VARCHAR(50) NOT NULL,
        iban VARCHAR(34) UNIQUE,
        bic VARCHAR(11),
        status VARCHAR(20) DEFAULT ''active'',
        daily_limit JSONB DEFAULT ''"1000000"'',
        monthly_limit JSONB DEFAULT ''"10000000"'',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.account_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        currency VARCHAR(3) NOT NULL,
        available JSONB DEFAULT ''"0"'',
        pending JSONB DEFAULT ''"0"'',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_account_id UUID,
        to_account_id UUID,
        amount JSONB NOT NULL,
        currency VARCHAR(3) NOT NULL,
        reference VARCHAR(140),
        transaction_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT ''pending'',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.ledger_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        transaction_id UUID NOT NULL,
        entry_type VARCHAR(10) NOT NULL,
        amount JSONB NOT NULL,
        currency VARCHAR(3) NOT NULL,
        balance_after JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.tontines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        admin_id UUID NOT NULL,
        target_amount JSONB NOT NULL,
        base_currency VARCHAR(3) DEFAULT ''XOF'',
        frequency VARCHAR(20),
        distribution_method VARCHAR(20) DEFAULT ''rotating'',
        status VARCHAR(20) DEFAULT ''active'',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.tontine_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tontine_id UUID NOT NULL,
        user_id UUID NOT NULL,
        contribution_amount JSONB NOT NULL,
        "order" INTEGER,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.tontine_cycles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tontine_id UUID NOT NULL,
        cycle_number INTEGER NOT NULL,
        recipient_user_id UUID NOT NULL,
        amount JSONB NOT NULL,
        currency VARCHAR(3) NOT NULL,
        disbursement_date TIMESTAMP,
        status VARCHAR(20) DEFAULT ''pending'',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.kyc_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        document_url VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT ''pending'',
        rejection_reason VARCHAR(255),
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.audit_logs (
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
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        assigned_to UUID,
        subject VARCHAR(200) NOT NULL,
        description VARCHAR(2000),
        category VARCHAR(50),
        priority VARCHAR(20) DEFAULT ''medium'',
        status VARCHAR(20) DEFAULT ''open'',
        resolution VARCHAR(2000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        resolved_at TIMESTAMP,
        closed_at TIMESTAMP
    )', schema_name);

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL,
        sender_id UUID NOT NULL,
        sender_role VARCHAR(20) NOT NULL,
        message VARCHAR(5000) NOT NULL,
        message_type VARCHAR(20) DEFAULT ''text'',
        file_url VARCHAR(500),
        is_read JSONB DEFAULT ''false'',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);
END;
$$ LANGUAGE plpgsql;

-- Creer les schemas et tables pour chaque tenant
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT country_code FROM core.tenants LOOP
        PERFORM create_tenant_tables('tenant_' || LOWER(rec.country_code));
    END LOOP;
END;
$$;

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

-- Insertion de quelques pays de demonstration
INSERT INTO core.tenants (name, country_code, regulatory_authority, base_currency) VALUES
('Senegal', 'SN', 'BCEAO', 'XOF'),
('Cote d''Ivoire', 'CI', 'BCEAO', 'XOF'),
('Nigeria', 'NG', 'Central Bank of Nigeria', 'NGN');

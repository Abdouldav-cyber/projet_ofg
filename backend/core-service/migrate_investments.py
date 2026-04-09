from sqlalchemy import text
from app.database import engine

def migrate():
    # Liste des schémas (tenants statiques pour Djembé Bank)
    # L'idéal est de les récupérer dynamiquement si c'est multi-tenant
    schemas = ['tenant_sn', 'tenant_ci']
    
    with engine.begin() as conn:
        for schema_name in schemas:
            print(f"Migration du schéma : {schema_name}")
            
            # Créer la table investment_projects
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.investment_projects (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(200) NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    annual_yield NUMERIC(5,2) NOT NULL,
                    risk_level VARCHAR(20) NOT NULL,
                    funding_goal NUMERIC(15,2) NOT NULL,
                    current_funding NUMERIC(15,2) DEFAULT 0,
                    min_investment NUMERIC(15,2) DEFAULT 10,
                    currency VARCHAR(3) DEFAULT 'XOF',
                    status VARCHAR(20) DEFAULT 'open',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            
            # Créer la table client_investments
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {schema_name}.client_investments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id UUID NOT NULL,
                    user_id UUID NOT NULL,
                    invested_amount NUMERIC(15,2) NOT NULL,
                    expected_yield NUMERIC(15,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_project FOREIGN KEY(project_id) REFERENCES {schema_name}.investment_projects(id) ON DELETE CASCADE,
                    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES {schema_name}.users(id) ON DELETE CASCADE
                );
            """))
            print(f"-> Tables d'investissement créées pour {schema_name}.")
            
if __name__ == "__main__":
    print("Début de la migration des investissements...")
    migrate()
    print("Migration terminée avec succès !")

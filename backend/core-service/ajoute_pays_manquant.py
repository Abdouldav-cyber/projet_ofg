import sys
import os
from sqlalchemy import text

# Ajout du chemin pour importer la configuration
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal

def add_missing_countries():
    print("🚀 Démarrage de l'ajout des pays (Tenants)...")
    db = SessionLocal()
    
    countries_to_add = [
        ('France', 'FR', 'Banque de France', 'EUR'),
        ('Belgique', 'BE', 'Banque Nationale de Belgique', 'EUR'),
        ('Etats-Unis', 'US', 'Federal Reserve', 'USD'),
        ('Canada', 'CA', 'Bank of Canada', 'CAD')
    ]
    
    added_count = 0
    
    try:
        for name, code, auth, currency in countries_to_add:
            # 1. Vérifier si le pays existe déjà
            result = db.execute(text("SELECT tenant_id FROM core.tenants WHERE country_code = :code"), {"code": code}).fetchone()
            
            if not result:
                # 2. Insérer le pays
                db.execute(text("""
                    INSERT INTO core.tenants (name, country_code, regulatory_authority, base_currency) 
                    VALUES (:name, :code, :auth, :currency)
                """), {"name": name, "code": code, "auth": auth, "currency": currency})
                
                # 3. Appeler la fantastique fonction SQL pour générer les tables de l'architecture !
                print(f"🏗 Création du schéma isolé pour {name} (tenant_{code.lower()})...")
                schema_name = f"tenant_{code.lower()}"
                db.execute(text("SELECT create_tenant_tables(:schema_name)"), {"schema_name": schema_name})
                
                added_count += 1
                print(f"✅ {name} ajouté avec succès !")
            else:
                print(f"ℹ️ Le pays {name} ({code}) existe déjà dans la base.")
                
        db.commit()
        print(f"\n🎉 Terminé ! {added_count} pays ajoutés. Vous n'avez pas besoin de redémarrer Docker ou d'effacer vos données !")
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur lors de l'ajout : {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # Définir l'URL si elle n'est pas déjà dans l'environnement local
    if not os.environ.get("DATABASE_URL"):
        os.environ["DATABASE_URL"] = "postgresql://admin:davou64598258@localhost:5432/djembe_bank"
        
    add_missing_countries()

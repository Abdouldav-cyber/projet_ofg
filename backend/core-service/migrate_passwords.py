"""
Script de migration pour forcer tous les utilisateurs à avoir des mots de passe sécurisés (min 20 caractères).

Ce script :
1. Parcourt tous les tenants (schémas)
2. Réinitialise les mots de passe de tous les utilisateurs avec des mots de passe temporaires sécurisés
3. Génère un fichier CSV avec les nouveaux identifiants
4. Les utilisateurs devront changer leur mot de passe à la première connexion
"""
import sys
import os
import csv
import secrets
import string
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, set_tenant_schema
from app.models import User, Tenant
from app.security import get_password_hash
from sqlalchemy import text


def generate_secure_password(length=24):
    """Génère un mot de passe aléatoire sécurisé de la longueur spécifiée."""
    # Assurer un mix de caractères
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))

    # S'assurer qu'il contient au moins une majuscule, une minuscule, un chiffre et un symbole
    if (any(c.islower() for c in password) and
        any(c.isupper() for c in password) and
        any(c.isdigit() for c in password) and
        any(c in "!@#$%^&*" for c in password)):
        return password
    else:
        # Régénérer si pas assez fort
        return generate_secure_password(length)


def migrate_all_passwords():
    """Migre tous les utilisateurs vers des mots de passe sécurisés."""
    db = SessionLocal()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_filename = f"nouveaux_identifiants_{timestamp}.csv"

    print("=" * 80)
    print("MIGRATION DES MOTS DE PASSE - DJEMBÉ BANK")
    print("=" * 80)
    print(f"\n⚠️  ATTENTION: Ce script va réinitialiser TOUS les mots de passe utilisateurs")
    print(f"📄 Les nouveaux identifiants seront sauvegardés dans: {csv_filename}\n")

    # Confirmation
    confirmation = input("Voulez-vous continuer? (tapez 'OUI' en majuscules): ")
    if confirmation != "OUI":
        print("❌ Migration annulée.")
        return

    # Récupérer tous les tenants
    tenants = db.query(Tenant).all()
    tenant_codes = [t.country_code for t in tenants]
    tenant_codes.append("public")  # Ajouter le schéma public

    all_updates = []
    total_users = 0

    for tenant_code in tenant_codes:
        print(f"\n🔄 Traitement du tenant: {tenant_code}")
        print("-" * 80)

        try:
            # Basculer vers le schéma du tenant
            set_tenant_schema(db, tenant_code)

            # Récupérer tous les utilisateurs
            users = db.query(User).all()

            if not users:
                print(f"   ℹ️  Aucun utilisateur trouvé dans {tenant_code}")
                continue

            print(f"   📊 {len(users)} utilisateur(s) trouvé(s)")

            for user in users:
                # Générer un nouveau mot de passe sécurisé
                new_password = generate_secure_password(24)
                new_hash = get_password_hash(new_password)

                # Mettre à jour le hash
                user.password_hash = new_hash

                # Stocker les infos pour le CSV
                all_updates.append({
                    'tenant_code': tenant_code,
                    'email': user.email,
                    'first_name': user.first_name or '',
                    'last_name': user.last_name or '',
                    'role': user.role,
                    'new_password': new_password
                })

                print(f"   ✅ {user.email} - Mot de passe réinitialisé")
                total_users += 1

            # Commit les changements pour ce tenant
            db.commit()
            print(f"   💾 Changements sauvegardés pour {tenant_code}")

        except Exception as e:
            print(f"   ❌ Erreur lors du traitement de {tenant_code}: {str(e)}")
            db.rollback()
            continue

    # Générer le fichier CSV avec les nouveaux identifiants
    if all_updates:
        with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['tenant_code', 'email', 'first_name', 'last_name', 'role', 'new_password']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()
            for update in all_updates:
                writer.writerow(update)

        print("\n" + "=" * 80)
        print("✅ MIGRATION TERMINÉE AVEC SUCCÈS!")
        print("=" * 80)
        print(f"\n📊 Statistiques:")
        print(f"   - Total utilisateurs migrés: {total_users}")
        print(f"   - Tenants traités: {len(tenant_codes)}")
        print(f"\n📄 Fichier généré: {csv_filename}")
        print(f"\n⚠️  IMPORTANT:")
        print(f"   1. Distribuez les nouveaux identifiants aux utilisateurs de manière sécurisée")
        print(f"   2. Demandez aux utilisateurs de changer leur mot de passe dès la première connexion")
        print(f"   3. Supprimez le fichier CSV après distribution pour des raisons de sécurité")
        print("=" * 80 + "\n")
    else:
        print("\n❌ Aucun utilisateur n'a été migré.")

    db.close()


def migrate_specific_tenant(tenant_code):
    """Migre uniquement les utilisateurs d'un tenant spécifique."""
    db = SessionLocal()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_filename = f"nouveaux_identifiants_{tenant_code}_{timestamp}.csv"

    print(f"\n🔄 Migration du tenant: {tenant_code}")
    print("-" * 80)

    try:
        set_tenant_schema(db, tenant_code)
        users = db.query(User).all()

        if not users:
            print(f"❌ Aucun utilisateur trouvé dans {tenant_code}")
            return

        print(f"📊 {len(users)} utilisateur(s) trouvé(s)")

        all_updates = []

        for user in users:
            new_password = generate_secure_password(24)
            new_hash = get_password_hash(new_password)
            user.password_hash = new_hash

            all_updates.append({
                'tenant_code': tenant_code,
                'email': user.email,
                'first_name': user.first_name or '',
                'last_name': user.last_name or '',
                'role': user.role,
                'new_password': new_password
            })

            print(f"✅ {user.email} - Mot de passe réinitialisé")

        db.commit()

        # Générer le CSV
        with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['tenant_code', 'email', 'first_name', 'last_name', 'role', 'new_password']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            for update in all_updates:
                writer.writerow(update)

        print(f"\n✅ Migration terminée pour {tenant_code}")
        print(f"📄 Fichier généré: {csv_filename}\n")

    except Exception as e:
        print(f"❌ Erreur: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("\n╔════════════════════════════════════════════════════════════════╗")
    print("║  SCRIPT DE MIGRATION DES MOTS DE PASSE - DJEMBÉ BANK         ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")

    if len(sys.argv) > 1:
        # Migration d'un tenant spécifique
        tenant_code = sys.argv[1]
        print(f"Mode: Migration d'un tenant spécifique ({tenant_code})")
        migrate_specific_tenant(tenant_code)
    else:
        # Migration de tous les tenants
        print("Mode: Migration de TOUS les tenants")
        migrate_all_passwords()

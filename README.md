# Backend Djembé Bank - Documentation Technique

## Architecture Globale
Djembé Bank utilise une architecture **Multi-Tenant SaaS** avec isolation logique par schémas PostgreSQL.

### Services
1.  **Gateway** : Point d'entrée unique, routage et authentification.
2.  **Account Service** : Gestion des comptes bancaires et balances.
3.  **Transaction Service** : Moteur saga pour les virements sécurisés.
4.  **KYC Service** : Vérification d'identité et gestion des pièces justificatives (S3).
5.  **Notification Service** : SMS (Twilio) et Emails (SendGrid) avec support OTP.
6.  **Fraud Engine** : Moteur de scoring temps réel pour la prévention de la fraude.

## Sécurité
- **Authentification** : JWT avec expiration courte.
- **MFA** : Obligatoire pour les transactions (TOTP/SMS).
- **Isolation** : Basculement de `search_path` dynamic par tenant.
- **Audit** : Journalisation immuable de chaque opération financière.

## Installation Locale
```bash
docker-compose up -d
cd backend/core-service
pip install -r requirements.txt
python main.py
```

## Déploiement Cloud
L'infrastructure est gérée via **Terraform** sur AWS (EKS, RDS, Redis). Les manifests sont disponibles dans `/infra/k8s`.

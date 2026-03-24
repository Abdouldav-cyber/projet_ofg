# 🧪 GUIDE COMPLET DE TEST - API DJEMBÉ BANK

Ce document vous guide pas à pas pour tester toutes les fonctionnalités de l'API Djembé Bank via Swagger.

---

## 📋 TABLE DES MATIÈRES

1. [Prérequis](#prérequis)
2. [Accéder à Swagger](#accéder-à-swagger)
3. [Comprendre les Tenants](#comprendre-les-tenants)
4. [Tests Authentification](#tests-authentification)
5. [Tests Comptes Bancaires](#tests-comptes-bancaires)
6. [Tests Transactions](#tests-transactions)
7. [Tests Tontines](#tests-tontines)
8. [Tests MFA (Authentification à 2 facteurs)](#tests-mfa)
9. [Tests Admin](#tests-admin)
10. [Codes d'erreur courants](#codes-derreur)

---

## 1. PRÉREQUIS

### ✅ Services en cours d'exécution

Vérifiez que Docker est lancé :
```bash
docker-compose up -d
docker ps
```

Vous devez voir :
- ✅ djembe-db (PostgreSQL)
- ✅ djembe-redis (Redis)
- ✅ djembe-kafka (Kafka)
- ✅ djembe-api (API FastAPI)

### 🌐 URLs importantes

- **Swagger UI** : http://localhost:8000/docs
- **ReDoc** : http://localhost:8000/redoc
- **API Base** : http://localhost:8000

---

## 2. ACCÉDER À SWAGGER

1. Ouvrez votre navigateur
2. Allez sur : http://localhost:8000/docs
3. Vous verrez tous les endpoints disponibles organisés par sections

---

## 3. COMPRENDRE LES TENANTS

Djembé Bank utilise une architecture **multi-tenant** (multi-pays).

### Codes tenants disponibles :
- `sn` - Sénégal
- `ci` - Côte d'Ivoire
- `ng` - Nigeria
- `gh` - Ghana

### ⚠️ IMPORTANT : Header requis pour toutes les requêtes

Ajoutez toujours ce header :
```
X-Tenant-Code: sn
```
(Ou le code du pays que vous voulez tester)

---

## 4. TESTS AUTHENTIFICATION

### 📝 Test 1 : Créer un compte utilisateur

**Endpoint** : `POST /api/v1/auth/register`

**Étapes** :
1. Cliquez sur l'endpoint dans Swagger
2. Cliquez sur **"Try it out"**
3. Ajoutez le header :
   - **Nom** : `X-Tenant-Code`
   - **Valeur** : `sn`
4. Corps de la requête :
```json
{
  "email": "test@djembe-bank.com",
  "password": "MonMotDePasse123!",
  "phone": "+221771234567",
  "full_name": "Test User"
}
```
5. Cliquez sur **"Execute"**

**Résultat attendu** :
```json
{
  "id": "uuid-généré",
  "email": "test@djembe-bank.com",
  "phone": "+221771234567",
  "full_name": "Test User",
  "role": "user",
  "status": "pending_kyc",
  "created_at": "2025-01-XX..."
}
```

---

### 🔐 Test 2 : S'authentifier (Login)

**Méthode 1 : Via la popup Swagger**

1. Cliquez sur le bouton **"Authorize" 🔓** en haut de la page
2. Remplissez :
   - **username** : `test@djembe-bank.com`
   - **password** : `MonMotDePasse123!`
   - **Laissez client_id et client_secret vides**
3. Cliquez sur **"Authorize"**
4. Fermez la popup

✅ Vous êtes maintenant authentifié ! Le cadenas devient 🔒

**Méthode 2 : Via l'endpoint direct**

**Endpoint** : `POST /api/v1/auth/login`

1. Corps de la requête (format `application/x-www-form-urlencoded`) :
```
username=test@djembe-bank.com
password=MonMotDePasse123!
```
2. **Execute**

**Résultat attendu** :
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

### 👤 Test 3 : Obtenir mon profil

**Endpoint** : `GET /api/v1/users/me`

**Prérequis** : Être authentifié (via Authorize)

**Étapes** :
1. Cliquez sur l'endpoint
2. **Try it out**
3. **Execute**

**Résultat attendu** :
```json
{
  "id": "uuid",
  "email": "test@djembe-bank.com",
  "full_name": "Test User",
  "phone": "+221771234567",
  "role": "user",
  "status": "pending_kyc",
  "kyc_level": 0,
  "created_at": "..."
}
```

---

## 5. TESTS COMPTES BANCAIRES

### 💳 Test 4 : Créer un compte bancaire

**Endpoint** : `POST /api/v1/accounts`

**Prérequis** : Être authentifié

**Corps de la requête** :
```json
{
  "account_type": "personal",
  "currency": "XOF"
}
```

**Résultat attendu** :
```json
{
  "id": "uuid-compte",
  "user_id": "uuid-utilisateur",
  "account_type": "personal",
  "iban": "SN12345678901234567890",
  "status": "active",
  "balance": {
    "XOF": {
      "available": "0",
      "pending": "0"
    }
  },
  "created_at": "..."
}
```

📝 **Note** : Gardez l'`id` du compte, vous en aurez besoin pour les tests suivants.

---

### 💰 Test 5 : Déposer de l'argent (Test)

**Endpoint** : `POST /api/v1/deposits`

**Corps de la requête** :
```json
{
  "account_id": "uuid-compte-créé",
  "amount": 100000,
  "currency": "XOF",
  "reference": "Dépôt initial test"
}
```

**Résultat attendu** :
```json
{
  "id": "uuid-transaction",
  "to_account_id": "uuid-compte",
  "amount": "100000",
  "currency": "XOF",
  "status": "completed",
  "transaction_type": "deposit",
  "created_at": "..."
}
```

---

### 📊 Test 6 : Voir mes comptes

**Endpoint** : `GET /api/v1/accounts/me`

**Résultat attendu** :
```json
[
  {
    "id": "uuid",
    "account_type": "personal",
    "iban": "SN12345678901234567890",
    "status": "active",
    "balance": {
      "XOF": {
        "available": "100000",
        "pending": "0"
      }
    }
  }
]
```

---

### 💵 Test 7 : Voir le solde d'un compte

**Endpoint** : `GET /api/v1/accounts/{account_id}/balance`

**Paramètres** :
- **account_id** : `uuid-compte`
- **currency** : `XOF`

**Résultat attendu** :
```json
{
  "account_id": "uuid",
  "currency": "XOF",
  "available": "100000",
  "pending": "0",
  "last_updated": "..."
}
```

---

## 6. TESTS TRANSACTIONS

### 💸 Test 8 : Virement entre comptes

**Prérequis** : Avoir 2 comptes avec de l'argent

**Endpoint** : `POST /api/v1/transfers`

**Corps de la requête** :
```json
{
  "from_account_id": "uuid-compte-1",
  "to_account_id": "uuid-compte-2",
  "amount": 10000,
  "currency": "XOF",
  "reference": "Virement test"
}
```

**Résultat attendu** :
```json
{
  "id": "uuid-transaction",
  "from_account_id": "uuid-compte-1",
  "to_account_id": "uuid-compte-2",
  "amount": "10000",
  "currency": "XOF",
  "status": "completed",
  "transaction_type": "internal",
  "reference": "Virement test",
  "created_at": "..."
}
```

---

### 📜 Test 9 : Historique des transactions

**Endpoint** : `GET /api/v1/accounts/{account_id}/transactions`

**Paramètres** :
- **account_id** : `uuid-compte`
- **limit** : `10` (optionnel)
- **offset** : `0` (optionnel)

**Résultat attendu** :
```json
{
  "total": 2,
  "transactions": [
    {
      "id": "uuid",
      "amount": "10000",
      "currency": "XOF",
      "status": "completed",
      "transaction_type": "internal",
      "created_at": "..."
    },
    ...
  ]
}
```

---

## 7. TESTS TONTINES

### 🎯 Test 10 : Créer une tontine

**Endpoint** : `POST /api/v1/tontines`

**Corps de la requête** :
```json
{
  "name": "Tontine Familiale",
  "target_amount": 500000,
  "base_currency": "XOF",
  "frequency": "monthly",
  "distribution_method": "rotating"
}
```

**Résultat attendu** :
```json
{
  "id": "uuid-tontine",
  "name": "Tontine Familiale",
  "admin_id": "uuid-utilisateur",
  "target_amount": "500000",
  "base_currency": "XOF",
  "frequency": "monthly",
  "distribution_method": "rotating",
  "status": "active",
  "created_at": "..."
}
```

---

### 👥 Test 11 : Rejoindre une tontine

**Endpoint** : `POST /api/v1/tontines/{tontine_id}/join`

**Paramètres** :
- **tontine_id** : `uuid-tontine`

**Corps de la requête** :
```json
{
  "contribution_amount": 50000
}
```

**Résultat attendu** :
```json
{
  "id": "uuid-membre",
  "tontine_id": "uuid-tontine",
  "user_id": "uuid-utilisateur",
  "contribution_amount": "50000",
  "order": 1,
  "joined_at": "..."
}
```

---

### 📋 Test 12 : Voir mes tontines

**Endpoint** : `GET /api/v1/tontines/me`

**Résultat attendu** :
```json
[
  {
    "id": "uuid-tontine",
    "name": "Tontine Familiale",
    "target_amount": "500000",
    "status": "active",
    "members_count": 5,
    "my_contribution": "50000"
  }
]
```

---

## 8. TESTS MFA (Authentification à 2 facteurs)

### 🔒 Test 13 : Activer le MFA

**Endpoint** : `POST /api/v1/auth/mfa/enable`

**Résultat attendu** :
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBORw0KG...",
  "message": "Scannez le QR code avec Google Authenticator"
}
```

📱 **Note** : Scannez le QR code avec Google Authenticator ou Authy

---

### ✅ Test 14 : Vérifier le code MFA

**Endpoint** : `POST /api/v1/auth/mfa/verify`

**Corps de la requête** :
```json
{
  "code": "123456"
}
```
(Utilisez le code à 6 chiffres de votre app d'authentification)

**Résultat attendu** :
```json
{
  "message": "MFA activé avec succès",
  "mfa_enabled": true
}
```

---

### 📱 Test 15 : Vérifier le statut MFA

**Endpoint** : `GET /api/v1/auth/mfa/status`

**Résultat attendu** :
```json
{
  "mfa_enabled": true,
  "methods": ["totp"]
}
```

---

## 9. TESTS ADMIN

⚠️ **Prérequis** : Avoir un compte avec le rôle `super_admin`, `country_admin` ou `support`

### 👨‍💼 Test 16 : Créer un tenant (Super Admin uniquement)

**Endpoint** : `POST /admin/tenants`

**Corps de la requête** :
```json
{
  "name": "Sénégal",
  "country_code": "sn",
  "regulatory_authority": "BCEAO",
  "base_currency": "XOF"
}
```

**Résultat attendu** :
```json
{
  "tenant_id": "uuid",
  "name": "Sénégal",
  "country_code": "sn",
  "status": "active",
  "created_at": "..."
}
```

---

### 📊 Test 17 : Voir les utilisateurs du pays (Country Admin)

**Endpoint** : `GET /admin/country/users`

**Paramètres** :
- **status** : `active` (optionnel)
- **limit** : `50`
- **offset** : `0`

**Résultat attendu** :
```json
[
  {
    "id": "uuid",
    "email": "test@djembe-bank.com",
    "full_name": "Test User",
    "status": "active",
    "kyc_level": 0,
    "created_at": "..."
  },
  ...
]
```

---

### ❄️ Test 18 : Geler un compte (Support L2)

**Endpoint** : `POST /support/accounts/{account_id}/freeze`

**Paramètres** :
- **account_id** : `uuid-compte`

**Corps de la requête** :
```json
{
  "reason": "Activité suspecte détectée"
}
```

**Résultat attendu** :
```json
{
  "message": "Compte gelé avec succès",
  "account_id": "uuid",
  "status": "frozen",
  "reason": "Activité suspecte détectée"
}
```

---

## 10. CODES D'ERREUR COURANTS

| Code | Signification | Cause probable |
|------|---------------|----------------|
| `400` | Bad Request | Données invalides dans la requête |
| `401` | Unauthorized | Token JWT manquant ou invalide |
| `403` | Forbidden | Permissions insuffisantes |
| `404` | Not Found | Ressource introuvable |
| `422` | Validation Error | Validation Pydantic échouée |
| `500` | Internal Server Error | Erreur serveur (voir logs) |

---

## 🔍 EXEMPLES D'ERREURS ET SOLUTIONS

### Erreur 1 : "Tenant ID manquant"
```json
{
  "detail": "Header X-Tenant-Code manquant"
}
```
**Solution** : Ajoutez le header `X-Tenant-Code: sn`

---

### Erreur 2 : "Identifiants invalides"
```json
{
  "detail": "Identifiants invalides"
}
```
**Solution** : Vérifiez email et mot de passe

---

### Erreur 3 : "Fonds insuffisants"
```json
{
  "detail": "Fonds insuffisants (Disponible: 0 XOF)"
}
```
**Solution** : Faites un dépôt d'abord

---

### Erreur 4 : "Permissions insuffisantes"
```json
{
  "detail": "Permission refusée"
}
```
**Solution** : Utilisez un compte avec le bon rôle

---

## 📝 SCÉNARIO DE TEST COMPLET

Voici un scénario de bout en bout pour tester tout le système :

### Étape 1 : Créer 2 utilisateurs
- Utilisateur A : `alice@djembe-bank.com`
- Utilisateur B : `bob@djembe-bank.com`

### Étape 2 : Créer des comptes pour chaque utilisateur
- Compte A : personnel en XOF
- Compte B : personnel en XOF

### Étape 3 : Déposer de l'argent
- Déposer 100,000 XOF sur le compte A

### Étape 4 : Virement
- Transférer 10,000 XOF de A vers B

### Étape 5 : Vérifier les soldes
- Compte A : 90,000 XOF
- Compte B : 10,000 XOF

### Étape 6 : Créer une tontine
- Alice crée une tontine "Famille" de 500,000 XOF

### Étape 7 : Bob rejoint la tontine
- Bob contribue 50,000 XOF

### Étape 8 : Activer le MFA
- Alice active le MFA sur son compte

---

## 🚀 COMMANDES UTILES

### Voir les logs de l'API
```bash
docker logs -f djembe-api
```

### Redémarrer l'API après modification
```bash
docker-compose restart api
```

### Reconstruire l'API
```bash
docker-compose up -d --build api
```

### Arrêter tous les services
```bash
docker-compose down
```

### Reset complet (⚠️ SUPPRIME TOUTES LES DONNÉES)
```bash
docker-compose down -v
docker-compose up -d
```

---

## 📚 RESSOURCES SUPPLÉMENTAIRES

- **Documentation complète** : `ARCHITECTURE_BACKEND.md`
- **Swagger UI** : http://localhost:8000/docs
- **ReDoc** : http://localhost:8000/redoc

---

## ✅ CHECKLIST DE TEST

Utilisez cette checklist pour vérifier que tout fonctionne :

- [ ] ✅ Créer un compte utilisateur
- [ ] ✅ Se connecter (login)
- [ ] ✅ Obtenir son profil
- [ ] ✅ Créer un compte bancaire
- [ ] ✅ Déposer de l'argent
- [ ] ✅ Voir le solde
- [ ] ✅ Faire un virement
- [ ] ✅ Voir l'historique
- [ ] ✅ Créer une tontine
- [ ] ✅ Rejoindre une tontine
- [ ] ✅ Activer le MFA
- [ ] ✅ Tester les endpoints admin

---

## 🎯 BONNES PRATIQUES

1. **Toujours tester avec le header `X-Tenant-Code`**
2. **S'authentifier avant de tester les endpoints protégés**
3. **Vérifier les logs en cas d'erreur** : `docker logs djembe-api`
4. **Utiliser des données de test réalistes**
5. **Tester les cas d'erreur aussi** (solde insuffisant, etc.)

---

## 📞 SUPPORT

En cas de problème :
1. Vérifiez que Docker est lancé : `docker ps`
2. Vérifiez les logs : `docker logs djembe-api`
3. Redémarrez l'API : `docker-compose restart api`

---

**🎉 Bonne chance avec vos tests !**

*Version : 1.0 - Djembé Bank Backend*

# 📖 DOCUMENTATION ARCHITECTURE BACKEND - DJEMBÉ BANK

## 📁 STRUCTURE GLOBALE DU PROJET

```
Projet_OFG/
├── backend/
│   ├── core-service/           # API principale FastAPI
│   │   ├── app/               # Code source application
│   │   ├── main.py            # Point d'entrée
│   │   ├── requirements.txt   # Dépendances Python
│   │   └── Dockerfile         # Conteneurisation
│   └── websocket-service/     # Serveur WebSocket temps réel
│       ├── main.py
│       └── requirements.txt
├── infra/
│   ├── init-db/               # Scripts initialisation PostgreSQL
│   ├── k8s/                   # Manifests Kubernetes
│   └── terraform/             # Infrastructure as Code
├── docker-compose.yml         # Orchestration services
└── ARCHITECTURE_BACKEND.md    # Ce document
```

---

## 🏗️ ARCHITECTURE MULTI-TENANT

### Principe de Fonctionnement

**Djembé Bank utilise une architecture SaaS Multi-Tenant avec isolation par schéma PostgreSQL.**

```
┌─────────────────────────────────────────┐
│         PostgreSQL Database              │
├─────────────────────────────────────────┤
│  Schema: core                            │
│    └── tenants (liste des pays)         │
├─────────────────────────────────────────┤
│  Schema: tenant_sn (Sénégal)            │
│    ├── users                             │
│    ├── accounts                          │
│    └── transactions                      │
├─────────────────────────────────────────┤
│  Schema: tenant_ci (Côte d'Ivoire)      │
│    ├── users                             │
│    ├── accounts                          │
│    └── transactions                      │
├─────────────────────────────────────────┤
│  Schema: tenant_ng (Nigeria)            │
│    └── ...                               │
└─────────────────────────────────────────┘
```

**Basculement automatique:**
- Header HTTP `X-Tenant-Code: SN` → Utilise `tenant_sn`
- Middleware intercepte et change `search_path` PostgreSQL
- Isolation totale des données par pays

---

## 📂 BACKEND/CORE-SERVICE/APP/ - DÉTAIL DES FICHIERS

### 1️⃣ **main.py** - Point d'Entrée Principal
**Rôle:** Configure et démarre l'application FastAPI

**Contenu:**
```python
# Création de l'app FastAPI
app = FastAPI(title="DJEMBE BANK - CORE API", version="1.0.0")

# Enregistrement des middlewares
app.add_middleware(TenantMiddleware)  # Multi-tenant

# Enregistrement des routers
app.include_router(router, prefix="/api/v1")          # Routes publiques
app.include_router(admin_router, prefix="/api/v1")    # Routes admin

# Documentation Swagger personnalisée
@app.get("/docs")
async def custom_swagger_ui_html():
    # Style customisé pour masquer badges
```

**Utilisation:**
```bash
python main.py  # Démarre le serveur sur http://localhost:8000
```

---

### 2️⃣ **models.py** - Modèles de Données SQLAlchemy
**Rôle:** Définit la structure de la base de données (tables)

**Modèles définis (10 tables):**

#### **Tenant** (Schema: `core`)
```python
# Table des pays/entités
tenant_id, name, country_code, regulatory_authority,
base_currency, status, created_at, config
```
**Exemple:** `{"country_code": "SN", "name": "Senegal", "base_currency": "XOF"}`

#### **User** (Schema: `tenant_*`)
```python
# Utilisateurs par pays
id, email, phone, password_hash, full_name,
date_of_birth, nationality, tax_id,  # ← Nouvellement ajoutés
role, mfa_enabled, mfa_secret,        # ← Chiffrés
status, kyc_level, risk_profile,     # ← Conformité
created_at, last_login
```
**Rôles possibles:** `user`, `admin`, `country_admin`, `super_admin`, `support_l1`, `support_l2`

#### **Account** (Schema: `tenant_*`)
```python
# Comptes bancaires
id, user_id, account_type, iban, bic,  # ← BIC ajouté
status, daily_limit, monthly_limit, created_at
```
**Types de comptes:** `personal`, `business`, `savings`, `tontine`, `multi_currency`

#### **AccountBalance** (Schema: `tenant_*`)
```python
# Soldes multi-devises
id, account_id, currency, available, pending, last_updated
```
**Exemple:** Un compte peut avoir 1000 XOF + 50 EUR

#### **Transaction** (Schema: `tenant_*`)
```python
# Flux financiers
id, from_account_id, to_account_id, amount, currency,
reference, transaction_type, status, created_at
```
**Statuts:** `pending`, `completed`, `failed`, `reversed`, `refunded`

#### **LedgerEntry** (Schema: `tenant_*`)
```python
# Grand livre comptable (immuable)
id, account_id, transaction_id, entry_type,
amount, currency, balance_after, created_at
```
**Principe:** Chaque transaction = 2 entrées (1 DEBIT + 1 CREDIT)

#### **Tontine** (Schema: `tenant_*`)
```python
# Épargne collective
id, name, admin_id, target_amount, base_currency,  # ← Devise ajoutée
frequency, distribution_method,  # ← Méthode ajoutée
status, created_at
```
**Méthodes:** `rotating`, `random`, `vote`

#### **TontineMember** (Schema: `tenant_*`)
```python
# Participants tontine
id, tontine_id, user_id, contribution_amount,
order, joined_at  # order = position dans rotation
```

#### **TontineCycle** ✨ NOUVEAU (Schema: `tenant_*`)
```python
# Historique des cycles
id, tontine_id, cycle_number, recipient_user_id,
amount, currency, disbursement_date, status, created_at
```
**Utilité:** Tracer qui a reçu quoi et quand

#### **SupportTicket** ✨ NOUVEAU (Schema: `tenant_*`)
```python
# Tickets support client
id, user_id, assigned_to, subject, description,
category, priority, status, resolution,
created_at, updated_at, resolved_at, closed_at
```

---

### 3️⃣ **database.py** - Gestion Connexion PostgreSQL
**Rôle:** Configure SQLAlchemy et gère le multi-tenant

**Fonctions principales:**

```python
# Connexion à PostgreSQL
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# Fonction pour basculer de schéma
def set_tenant_schema(db: Session, tenant_code: str):
    db.execute(f"SET search_path TO tenant_{tenant_code}, public")

# Dépendance FastAPI
def get_db():
    # Fournit une session DB pour chaque requête
```

**Usage dans routes:**
```python
@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db_with_tenant)):
    # db pointe déjà vers le bon schéma tenant
    return db.query(Account).all()
```

---

### 4️⃣ **config.py** - Configuration Centralisée
**Rôle:** Variables d'environnement et constantes

**Variables définies:**
```python
DATABASE_URL = "postgresql://admin:password@localhost:5432/djembe_bank"
REDIS_URL = "redis://localhost:6379/0"
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
JWT_SECRET = "djembe-bank-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
```

**Lecture depuis fichier `.env`:**
```bash
# .env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ENCRYPTION_KEY=64-char-hex-key
```

---

### 5️⃣ **routes.py** - Routes API Publiques
**Rôle:** Endpoints accessibles aux utilisateurs finaux

**Routes définies (18 endpoints):**

#### **Authentification**
```python
POST /api/v1/auth/register          # Inscription
POST /api/v1/auth/login             # Connexion (retourne JWT)
POST /api/v1/auth/mfa/enable        # Activer 2FA
POST /api/v1/auth/mfa/verify        # Vérifier code TOTP
POST /api/v1/auth/mfa/disable       # Désactiver 2FA
GET  /api/v1/auth/mfa/status        # Statut MFA
```

#### **Services Bancaires**
```python
POST /api/v1/accounts               # Créer compte
GET  /api/v1/accounts               # Lister comptes
POST /api/v1/accounts/{id}/deposit  # Dépôt test
POST /api/v1/transfers              # Virement
```

#### **Tontines**
```python
POST /api/v1/tontines               # Créer tontine
POST /api/v1/tontines/{id}/members  # Ajouter membre
GET  /api/v1/tontines/{id}/members  # Liste membres
```

#### **Tenants**
```python
GET  /api/v1/tenants                # Liste pays
POST /api/v1/tenants                # Créer pays (admin)
```

#### **KYC**
```python
POST /api/v1/kyc/upload             # Upload document
```

#### **Notifications**
```python
POST /api/v1/notifications/test-sms # Test SMS
```

**Exemple d'utilisation:**
```bash
# Inscription
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Code: SN" \
  -d '{
    "email": "user@example.com",
    "phone": "+221771234567",
    "full_name": "John Doe",
    "password": "SecurePass123!"
  }'

# Connexion
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Tenant-Code: SN" \
  -d "username=user@example.com&password=SecurePass123!"
```

---

### 6️⃣ **routes_admin.py** - Routes API Administration
**Rôle:** Endpoints réservés aux administrateurs

**Routes définies (14 endpoints):**

#### **Super Admin**
```python
POST   /api/v1/admin/tenants                    # Créer pays + schéma DB
GET    /api/v1/admin/tenants/{id}/analytics     # Métriques pays
GET    /api/v1/admin/audit-logs                 # Logs globaux
PATCH  /api/v1/admin/users/{id}                 # Modifier user cross-tenant
```

#### **Country Admin**
```python
GET    /api/v1/admin/country/users              # Users du tenant
POST   /api/v1/admin/country/kyc/{id}/verify    # Valider KYC
GET    /api/v1/admin/country/transactions       # Transactions pays
GET    /api/v1/admin/country/reports            # Rapports (daily/weekly/monthly)
```

#### **Support Agent**
```python
GET    /api/v1/support/users/{id}                # Consulter client
POST   /api/v1/support/accounts/{id}/freeze      # Gel compte (L2)
POST   /api/v1/support/accounts/{id}/unfreeze    # Dégel (L2)
POST   /api/v1/support/transactions/{id}/refund  # Remboursement (L2)
```

**Protection par RBAC:**
```python
@router.get("/admin/tenants/{id}/analytics", dependencies=[RequireSuperAdmin])
def get_analytics(...):
    # Seuls les super_admin peuvent accéder
```

---

### 7️⃣ **schemas.py** - Validation Pydantic
**Rôle:** Valide et sérialise les données API

**Schémas définis:**

```python
# Requête création utilisateur
class UserCreate(BaseModel):
    email: str
    phone: str
    full_name: str
    password: str

# Réponse utilisateur (sans mot de passe)
class UserResponse(BaseModel):
    id: UUID
    email: str
    phone: str
    full_name: str
    role: str
    status: str
    created_at: datetime

# Token JWT
class Token(BaseModel):
    access_token: str
    token_type: str
    tenant_code: str

# Création compte
class AccountCreate(BaseModel):
    account_type: str
    initial_currency: str = "XOF"

# Transaction
class TransactionCreate(BaseModel):
    from_account: str
    to_account: str
    amount: Decimal
    currency: str
    reference: Optional[str]
```

**Validation automatique:**
```python
@router.post("/accounts")
def create_account(account: AccountCreate):
    # Pydantic valide automatiquement:
    # - Types (str, Decimal, etc.)
    # - Champs requis
    # - Format email, etc.
```

---

### 8️⃣ **security.py** - Sécurité et JWT
**Rôle:** Hash mots de passe et génère tokens JWT

**Fonctions:**

```python
# Hash mot de passe (bcrypt)
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# Vérifier mot de passe
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# Créer token JWT
def create_access_token(data: dict) -> str:
    payload = {
        "sub": email,
        "user_id": uuid,
        "role": role,
        "tenant_id": tenant,
        "exp": expire_timestamp
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")
```

**Token JWT généré:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwidXNlcl9pZCI6InV1aWQiLCJyb2xlIjoidXNlciIsInRlbmFudF9pZCI6IlNOIiwiZXhwIjoxNzM2MzQ1Njc4fQ.signature
```

---

### 9️⃣ **rbac.py** - Contrôle d'Accès (RBAC)
**Rôle:** Vérifie les permissions granulaires

**Architecture:**

```python
# Classe CurrentUser
class CurrentUser:
    user_id, email, role, tenant_id
    permissions: List[str]  # ["users:read", "accounts:freeze"]

    def has_permission(self, perm: str) -> bool:
        # Vérifie si user a la permission

# Dépendances prédéfinies
RequireSuperAdmin = Depends(require_role(["super_admin"]))
RequireKYCApproval = Depends(require_permissions(["kyc:approve", "kyc:reject"]))

# Middleware de vérification
def require_permissions(permissions: List[str]):
    # Vérifie que current_user a toutes les permissions
```

**Utilisation:**
```python
@router.get("/admin/data", dependencies=[RequireSuperAdmin])
def get_admin_data(current_user: CurrentUser = Depends(get_current_user)):
    # current_user.role == "super_admin" garanti
    return {"data": "..."}
```

---

### 🔟 **permissions.py** - Définitions Permissions
**Rôle:** Définit les 40+ permissions et 5 rôles

**Permissions (extrait):**
```python
class Permission(str, Enum):
    # Tenants
    TENANTS_CREATE = "tenants:create"
    TENANTS_READ = "tenants:read"
    TENANTS_ALL = "tenants:*"

    # Users
    USERS_READ = "users:read"
    USERS_UPDATE = "users:update"
    USERS_ACTIVATE = "users:activate"

    # Accounts
    ACCOUNTS_FREEZE = "accounts:freeze"
    ACCOUNTS_UNFREEZE = "accounts:unfreeze"

    # Transactions
    TRANSACTIONS_REFUND = "transactions:refund"

    # KYC
    KYC_APPROVE = "kyc:approve"
    KYC_REJECT = "kyc:reject"
```

**Rôles:**
```python
ROLES = {
    "super_admin": {
        "permissions": ["tenants:*", "users:*", "config:write", ...],
        "scope": "global"  # Accès tous les tenants
    },
    "country_admin": {
        "permissions": ["users:read", "kyc:approve", "reports:generate"],
        "scope": "tenant"  # Accès uniquement son tenant
    },
    "support_l2": {
        "permissions": ["accounts:freeze", "transactions:refund"],
        "scope": "tenant"
    }
}
```

**Vérification avec wildcards:**
```python
has_permission(["users:*"], "users:read")  # ✅ True
has_permission(["users:read"], "users:update")  # ❌ False
```

---

### 1️⃣1️⃣ **banking.py** - Moteur de Transactions
**Rôle:** Gère les virements avec pattern Saga

**Architecture Saga:**

```python
class TransactionSaga:
    # État: INITIATED → VALIDATED → RESERVED → EXECUTED → COMPLETED

    async def validate(self):
        # Vérifier comptes actifs, montant > 0

    async def check_balance(self):
        # Vérifier fonds + limites daily/monthly

    async def reserve_funds(self):
        # Transférer de available → pending
        # Timeout Redis 5 minutes

    async def execute(self):
        # Double-entrée: DEBIT + CREDIT
        # Ledger immuable

    async def complete(self):
        # Marquer status = completed
        # Publier événements Redis

    async def rollback(self):
        # Compensation automatique si erreur
```

**Événements publiés:**
```python
# 1. Transaction complétée
redis.publish("transactions.completed", {
    "transaction_id": uuid,
    "from_user_id": uuid,
    "to_user_id": uuid,
    "amount": "10000",
    "currency": "XOF"
})

# 2. Solde mis à jour (émetteur)
redis.publish("account.updated", {
    "user_id": uuid,
    "account_id": uuid,
    "balance": "50000",
    "currency": "XOF"
})

# 3. Solde mis à jour (destinataire)
redis.publish("account.updated", {...})
```

**Usage:**
```python
tx = await TransactionEngine.execute_transfer(
    db=db,
    from_account_id="uuid1",
    to_account_id="uuid2",
    amount=Decimal("10000"),
    currency="XOF"
)
# Rollback automatique en cas d'erreur
```

---

### 1️⃣2️⃣ **fraud.py** - Détection de Fraude
**Rôle:** Analyse et score les transactions

**Feature Engineering (12 features):**
```python
features = {
    "amount": 1000000,
    "hour_of_day": 14,
    "day_of_week": 2,
    "is_business_hours": True,
    "user_velocity_24h": 3,      # Nb transactions 24h
    "user_velocity_1h": 1,       # Nb transactions 1h
    "avg_transaction_amount": 50000,
    "amount_deviation": 20.0,    # 2000% du montant moyen
    "is_new_recipient": True,
    "account_age_days": 5,
    "recipient_exists": True,
    "is_round_number": True
}
```

**Règles heuristiques:**
```python
score = 0

# Montant très élevé
if amount > 10M XOF: score += 25
elif amount > 5M XOF: score += 15

# Vélocité suspecte
if velocity_1h > 5: score += 30
elif velocity_24h > 10: score += 20

# Compte récent
if account_age_days < 7: score += 15

# Déviation montant
if deviation > 3: score += 20  # 300%

# Nouveau destinataire + montant élevé
if new_recipient and amount > 1M: score += 15
```

**Classification:**
```python
if score < 30: risk = "LOW"       # Autoriser
elif score < 70: risk = "MEDIUM"  # Flag pour review
else: risk = "HIGH"               # Bloquer automatiquement
```

**Usage:**
```python
result = FraudEngine.score_transaction(
    db=db,
    user_id=uuid,
    account_id=uuid,
    amount=Decimal("1000000"),
    currency="XOF"
)

if result["should_block"]:
    raise HTTPException(400, "Transaction bloquée: " + result["flags"])
```

---

### 1️⃣3️⃣ **encryption.py** - Chiffrement AES-256-GCM
**Rôle:** Protège les données sensibles (PII)

**Fonctionnement:**
```python
# Chiffrer
encrypted = encrypt_field("123-45-6789")
# Résultat: "iv_base64:tag_base64:ciphertext_base64"

# Déchiffrer
plaintext = decrypt_field(encrypted)
# Résultat: "123-45-6789"
```

**Format:**
```
IV (12 bytes) : Tag (16 bytes) : Ciphertext
[random]      : [authenticity] : [encrypted data]
```

**Utilisation avec modèles:**
```python
# Sauvegarder
user.tax_id = encrypt_field("123-45-6789")
db.commit()

# Lire
tax_id = decrypt_field(user.tax_id)  # "123-45-6789"
```

**Rotation des clés:**
```python
old_service = EncryptionService(old_key)
new_service = EncryptionService(new_key)

# Réchiffrer toutes les données
new_encrypted = new_service.rotate_key(old_service, old_encrypted)
```

**Champs à chiffrer:**
- `User.tax_id` - Numéro fiscal
- `User.mfa_secret` - Secret TOTP
- Documents KYC sensibles

---

### 1️⃣4️⃣ **tontine_engine.py** - Moteur Tontines
**Rôle:** Gère les cycles et distributions

**Fonctions principales:**

```python
# Créer tontine
tontine = TontineEngine.create_tontine(
    db=db,
    name="Épargne Famille",
    admin_id=uuid,
    target_amount=Decimal("100000"),
    frequency="monthly",
    distribution_method="rotating"
)

# Ajouter membre
member = TontineEngine.add_member(
    db=db,
    tontine_id=uuid,
    user_id=uuid,
    contribution_amount=Decimal("10000")
)

# Démarrer (fermer inscriptions)
TontineEngine.start_tontine(db, tontine_id, admin_id)

# Distribuer cycle
tx = TontineEngine.distribute(
    db=db,
    tontine_id=uuid,
    cycle_number=1
)
# Crée un TontineCycle en DB
```

**Méthodes de distribution:**
```python
# Rotating: Ordre fixe (1, 2, 3...)
recipient = members[cycle_number % len(members)]

# Random: Aléatoire parmi ceux qui n'ont pas reçu
recipient = random.choice(members_not_received)

# Vote: Les membres votent (à implémenter)
```

**Notifications:**
```python
TontineEngine.notify_members(
    db=db,
    tontine_id=uuid,
    message="Cycle 3 distribué à Jean Dupont"
)
# Publie sur Redis → WebSocket
```

---

### 1️⃣5️⃣ **currency.py** - Conversion de Devises
**Rôle:** Taux de change avec API externe

**Stratégie multi-niveaux:**
```python
# 1. Cache Redis (TTL 5 min)
cached = redis.get(f"rate:EUR:XOF")
if cached: return Decimal(cached)

# 2. API externe (ExchangeRate-API)
response = requests.get(f"https://api.exchangerate-api.com/v4/latest/EUR")
rate = response.json()["rates"]["XOF"]

# 3. Fallback taux fixes
if api_down:
    rate = FIXED_RATES["EUR_XOF"]  # 655.957

# 4. Cache pour 5 minutes
redis.setex("rate:EUR:XOF", 300, str(rate))
```

**Usage:**
```python
service = get_currency_service()

# Convertir
result = service.convert(
    amount=Decimal("100"),
    from_currency="EUR",
    to_currency="XOF"
)  # ~65595.70 XOF

# Tous les taux
rates = service.get_all_rates("EUR")
# {"XOF": 655.957, "USD": 1.08, ...}
```

**Logging conformité:**
```python
service.log_conversion(
    amount=Decimal("100"),
    from_currency="EUR",
    to_currency="XOF",
    rate=Decimal("655.957"),
    result=Decimal("65595.70"),
    user_id=uuid
)
# Stocké dans Redis list (1000 dernières conversions)
```

---

### 1️⃣6️⃣ **mfa.py** - Authentification Multi-Facteurs
**Rôle:** TOTP (Google Authenticator)

**Fonctions:**

```python
# Générer secret
secret = MFAService.generate_totp_secret()
# "JBSWY3DPEHPK3PXP" (base32)

# Générer URI
uri = MFAService.get_totp_uri(secret, "user@djembe.com")
# "otpauth://totp/DjembeBank:user@djembe.com?secret=..."

# Générer QR code
qr_base64 = MFAService.generate_qr_code_base64(uri)
# "data:image/png;base64,iVBORw0KG..."

# Vérifier code
is_valid = MFAService.verify_totp_code(secret, "123456")
# True si code valide (fenêtre ±2 x 30s)
```

**Flow d'activation:**
```
1. POST /auth/mfa/enable
   ← secret + QR code

2. Scan QR code dans Google Authenticator

3. POST /auth/mfa/verify (code=123456)
   → mfa_enabled = True

4. Login requiert maintenant code TOTP
```

---

### 1️⃣7️⃣ **kyc.py** - Know Your Customer
**Rôle:** Vérification d'identité

**Modèle:**
```python
class KYCDocument(Base):
    id, user_id, document_type, document_url,
    status, rejection_reason,
    submitted_at, verified_at
```

**Types de documents:**
- `CNI` - Carte Nationale d'Identité
- `PASSPORT` - Passeport
- `PROOF_OF_RESIDENCE` - Justificatif de domicile

**Fonctions:**
```python
# Upload document
doc = KYCService.upload_document(
    db=db,
    user_id=uuid,
    document_type="CNI",
    file_data=base64_image
)
# Status: pending

# Vérifier (admin)
KYCService.verify_document(
    db=db,
    doc_id=uuid,
    approved=True
)
# Status: verified
# User.status: pending_kyc → active
```

**Niveaux KYC:**
```python
User.kyc_level = 0  # Non vérifié (limites basses)
User.kyc_level = 1  # Basique (CNI)
User.kyc_level = 2  # Intermédiaire (CNI + justificatif)
User.kyc_level = 3  # Complet (tout + vérification vidéo)
```

---

### 1️⃣8️⃣ **notifications.py** - SMS/Email
**Rôle:** Envoyer notifications

**Canaux:**

```python
# SMS via Twilio
NotificationService.send_sms(
    phone="+221771234567",
    message="Votre code: 123456"
)

# OTP SMS
NotificationService.send_otp(
    phone="+221771234567"
)
# Retourne code 6 chiffres

# Email via SendGrid
NotificationService.send_email(
    to="user@example.com",
    subject="Transaction effectuée",
    html_content="<h1>Votre virement...</h1>"
)
```

**Configuration:**
```python
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE = os.getenv("TWILIO_PHONE")

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = "noreply@djembebank.com"
```

---

### 1️⃣9️⃣ **audit.py** - Journal d'Audit
**Rôle:** Logs immuables de toutes les actions

**Modèle enrichi:**
```python
class AuditLog(Base):
    id, user_id, tenant_id, session_id,  # ← Nouveaux
    action, resource, resource_id,
    before_value, after_value,  # ← Nouveaux
    details, ip_address, user_agent,
    created_at
```

**Exemples d'actions:**
```python
# Connexion
AuditLog(
    user_id=uuid,
    action="LOGIN",
    resource="users",
    ip_address="192.168.1.1"
)

# Modification
AuditLog(
    user_id=uuid,
    action="UPDATE_USER",
    resource="users",
    resource_id=uuid,
    before_value={"role": "user"},
    after_value={"role": "admin"}
)

# Transaction
AuditLog(
    user_id=uuid,
    action="TRANSFER",
    resource="transactions",
    resource_id=uuid,
    details={"amount": 10000, "to": uuid}
)
```

**Recherche:**
```python
# Tous les logs d'un user
logs = db.query(AuditLog).filter(
    AuditLog.user_id == uuid
).order_by(AuditLog.created_at.desc()).all()

# Logs d'une action
logs = db.query(AuditLog).filter(
    AuditLog.action == "TRANSFER"
).all()
```

---

### 2️⃣0️⃣ **tenant_manager.py** - Middleware Multi-Tenant
**Rôle:** Bascule automatique de schéma

**TenantMiddleware:**
```python
class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Extraire X-Tenant-Code header
        tenant_code = request.headers.get("X-Tenant-Code")

        # Stocker dans request.state
        request.state.tenant_code = tenant_code

        return await call_next(request)
```

**get_db_with_tenant:**
```python
def get_db_with_tenant(request: Request):
    db = SessionLocal()
    tenant_code = request.state.tenant_code

    if tenant_code:
        # Basculer schéma PostgreSQL
        set_tenant_schema(db, tenant_code)

    yield db
    db.close()
```

**Usage:**
```bash
# Requête vers Sénégal
curl -H "X-Tenant-Code: SN" http://localhost:8000/api/v1/accounts
# Utilise schema: tenant_sn

# Requête vers Côte d'Ivoire
curl -H "X-Tenant-Code: CI" http://localhost:8000/api/v1/accounts
# Utilise schema: tenant_ci
```

---

## 📁 BACKEND/WEBSOCKET-SERVICE/

### **main.py** - Serveur WebSocket
**Rôle:** Notifications temps réel

**Architecture:**
```python
# Connexions actives
clients = {
    "user_id_1": {websocket1, websocket2},
    "user_id_2": {websocket3}
}

# Authentification JWT
@server.on_connect
async def handle_connection(websocket, path):
    token = extract_from_query(path)  # ?token=xxx
    user = authenticate(token)

    clients[user.id].add(websocket)

    # Heartbeat 30s
    asyncio.create_task(heartbeat(websocket))

# Écoute Redis Pub/Sub
async def redis_listener():
    pubsub = redis.pubsub()
    pubsub.subscribe("transactions.completed", "account.updated")

    async for message in pubsub.listen():
        # Dispatcher aux clients WebSocket
        await send_to_user(user_id, message)
```

**Événements envoyés:**
```json
// Transaction complétée
{
  "type": "transaction",
  "event": "completed",
  "data": {
    "transaction_id": "uuid",
    "amount": "10000",
    "currency": "XOF"
  }
}

// Solde mis à jour
{
  "type": "balance_update",
  "data": {
    "account_id": "uuid",
    "new_balance": "50000",
    "currency": "XOF"
  }
}
```

**Client JavaScript:**
```javascript
const ws = new WebSocket(`ws://localhost:8080?token=${jwt}`);

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'balance_update') {
        updateBalanceUI(data.data.new_balance);
    }
};
```

---

## 📁 INFRA/

### **init-db/01-init.sql** - Initialisation PostgreSQL
**Rôle:** Crée schémas et tenants de démo

```sql
-- Créer schéma central
CREATE SCHEMA core;

-- Table des tenants
CREATE TABLE core.tenants (...);

-- Insérer pays de démo
INSERT INTO core.tenants VALUES
('Senegal', 'SN', 'BCEAO', 'XOF'),
('Cote d''Ivoire', 'CI', 'BCEAO', 'XOF'),
('Nigeria', 'NG', 'Central Bank of Nigeria', 'NGN');
```

**Exécution automatique:**
- Monté dans Docker Compose
- Exécuté au premier démarrage de PostgreSQL

---

## 🐳 DOCKER-COMPOSE.YML

**Services orchestrés (5):**

```yaml
services:
  db:          # PostgreSQL 15
  zookeeper:   # Coordination Kafka
  kafka:       # Bus de messages
  redis:       # Cache et Pub/Sub
  api:         # Backend FastAPI
```

**Réseau:**
- Tous les services sur le même réseau Docker
- Communication inter-services par nom (db:5432, redis:6379)

**Volumes:**
- `postgres_data` - Données persistantes
- `./infra/init-db` - Scripts d'initialisation

**Usage:**
```bash
# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f api

# Arrêter
docker-compose down
```

---

## 🔄 FLUX D'UNE TRANSACTION COMPLÈTE

**Exemple: Virement de 10000 XOF**

```
1. CLIENT
   POST /api/v1/transfers
   Headers: Authorization: Bearer xxx, X-Tenant-Code: SN
   Body: {from_account: uuid1, to_account: uuid2, amount: 10000}

2. MIDDLEWARE (tenant_manager.py)
   → Extrait X-Tenant-Code: SN
   → Bascule vers schema tenant_sn

3. RBAC (rbac.py)
   → Vérifie JWT
   → Vérifie permission "transactions:create"

4. FRAUD (fraud.py)
   → Score transaction: 25/100 (LOW RISK)
   → Autoriser

5. BANKING (banking.py)
   → TransactionSaga.validate()
   → TransactionSaga.check_balance() + limites
   → TransactionSaga.reserve_funds() (Redis 5min)
   → TransactionSaga.execute()
     - LedgerEntry DEBIT (compte 1)
     - LedgerEntry CREDIT (compte 2)
   → TransactionSaga.complete()
     - Status = completed
     - Publish Redis events

6. REDIS PUB/SUB
   → Publie "transactions.completed"
   → Publie "account.updated" (x2)

7. WEBSOCKET (main.py)
   → Reçoit événements Redis
   → Envoie aux clients connectés

8. AUDIT (audit.py)
   → Log immuable de la transaction

9. RESPONSE
   → 201 Created
   → {transaction_id, status, timestamp}
```

---

## 📊 STATISTIQUES DU PROJET

**Code Backend:**
- **20 fichiers Python** (~4500 lignes)
- **10 modèles** de données
- **32+ endpoints** API
- **40+ permissions** RBAC
- **5 rôles** utilisateurs
- **12 features** détection fraude
- **3 événements** temps réel

**Technologies:**
- FastAPI 0.115+
- SQLAlchemy 2.0
- PostgreSQL 15
- Redis 7.2
- WebSockets 12.0
- Cryptography (AES-256-GCM)
- PyOTP (TOTP/2FA)

**Dépendances (requirements.txt):**
- 18 packages principaux
- Poids total: ~200 MB

---

## 🚀 COMMANDES UTILES

```bash
# Démarrer l'infrastructure
docker-compose up -d

# Installer dépendances
cd backend/core-service
pip install -r requirements.txt

# Démarrer API
python main.py
# → http://localhost:8000

# Démarrer WebSocket
cd ../websocket-service
python main.py
# → ws://localhost:8080

# Documentation API
# → http://localhost:8000/docs

# Logs
docker-compose logs -f api

# Accès PostgreSQL
docker exec -it djembe-db psql -U admin -d djembe_bank

# Accès Redis
docker exec -it djembe-redis redis-cli

# Tests
pytest backend/core-service/tests/
```

---

## 📚 RESSOURCES SUPPLÉMENTAIRES

**Documentation API:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**Fichiers de référence:**
- Cahier des charges: (fourni par utilisateur)
- Plan d'implémentation: `C:\Users\ASUS\.claude\plans\cached-purring-star.md`
- Architecture backend: Ce document

**Prochaines étapes:**
1. Développer interfaces Admin (React/Vue)
2. Développer application Web client
3. Développer application Mobile (React Native/Flutter)
4. Tests d'intégration complets
5. Déploiement production (AWS EKS)

---

**Document créé le:** 2025-01-15
**Version:** 1.0
**Auteur:** Claude Code (Anthropic)
**Projet:** Djembé Bank - Néobanque SaaS pour l'Afrique

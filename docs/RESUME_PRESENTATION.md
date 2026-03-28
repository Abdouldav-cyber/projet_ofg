# Djembe Bank - Resume de Presentation du Projet

## Introduction

**Djembe Bank** est une plateforme bancaire digitale **multi-tenant SaaS** destinee aux pays d'Afrique de l'Ouest. Elle permet a chaque pays (Senegal, Cote d'Ivoire, etc.) d'operer une instance bancaire isolee sur une infrastructure partagee. Le nom "Djembe" fait reference au tambour ouest-africain, symbolisant la communication et le rassemblement communautaire.

**Objectif principal :** Offrir des services bancaires modernes (comptes, virements, tontines) avec une conformite reglementaire stricte (KYC, anti-fraude, audit) et une administration multi-niveaux.

---

## Etape 1 : Architecture et Conception

### 1.1 Choix Architecturaux

| Composant | Technologie | Justification |
|-----------|------------|---------------|
| Backend API | **FastAPI** (Python) | Performance async, documentation Swagger auto |
| Base de donnees | **PostgreSQL 15** | Schemas multiples pour isolation multi-tenant |
| Cache | **Redis 7.2** | Sessions, cache taux de change, Pub/Sub |
| Messaging | **Apache Kafka** | Event streaming pour transactions |
| Frontend Admin | **React + TypeScript + MUI** | Dashboard admin moderne |
| WebSocket | **Python websockets** | Notifications temps reel |
| Conteneurisation | **Docker Compose** | Orchestration de 7 services |

### 1.2 Architecture Multi-Tenant

Le systeme utilise l'**isolation par schema PostgreSQL** :
- Schema `core` : Donnees globales (tenants, audit global)
- Schema `tenant_sn` : Donnees du Senegal
- Schema `tenant_ci` : Donnees de Cote d'Ivoire
- Schema `tenant_xx` : Chaque nouveau pays

Chaque requete HTTP porte un header `X-Tenant-Code` qui determine dynamiquement le `search_path` PostgreSQL. Cela garantit une **isolation complete des donnees** entre pays sans duplication de code.

### 1.3 Services Docker

| Service | Port | Role |
|---------|------|------|
| `djembe-api` | 8000 | API Backend principal (FastAPI) |
| `djembe-frontend-admin` | 3000 | Dashboard d'administration (React) |
| `djembe-db` | 5432 | Base de donnees PostgreSQL |
| `djembe-redis` | 6379 | Cache et Pub/Sub |
| `djembe-kafka` | 9092 | Event streaming |
| `djembe-zookeeper` | 2181 | Coordination Kafka |
| `djembe-websocket` | 8080 | Notifications temps reel |

---

## Etape 2 : Modelisation des Donnees

### 2.1 Modele Conceptuel de Donnees (MCD)

> Voir diagramme : `docs/diagrammes/03_MCD.puml`

**13 entites principales :**

| Entite | Description | Schema |
|--------|------------|--------|
| **Tenant** | Pays/entite operationnelle | core |
| **User** | Utilisateur (client, agent, admin) | tenant |
| **Account** | Compte bancaire (personal, business, savings, tontine) | tenant |
| **AccountBalance** | Solde par devise (available + pending) | tenant |
| **Transaction** | Mouvement financier (virement, depot, tontine) | tenant |
| **LedgerEntry** | Ecriture comptable immutable (DEBIT/CREDIT) | tenant |
| **Tontine** | Groupe d'epargne collective | tenant |
| **TontineMember** | Membre d'une tontine avec montant de contribution | tenant |
| **TontineCycle** | Cycle de distribution (qui recoit quand) | tenant |
| **KYCDocument** | Document de verification d'identite | tenant |
| **SupportTicket** | Ticket de support client | tenant |
| **ChatMessage** | Message de chat en temps reel | tenant |
| **AuditLog** | Journal d'audit immutable (conformite) | tenant + core |

### 2.2 Regles de Gestion Cles

- Un **utilisateur** possede 0 a N **comptes** bancaires
- Un **compte** a 1 a N **soldes** (multi-devise : XOF, EUR, USD)
- Chaque **transaction** produit exactement **2 ecritures comptables** (double-entree : 1 DEBIT + 1 CREDIT)
- Une **tontine** contient 2 a N **membres** qui contribuent periodiquement
- Chaque **cycle de tontine** a un unique **beneficiaire** qui recoit la cagnotte
- Un **ticket de support** peut contenir 0 a N **messages de chat**
- Chaque action sensible genere un **log d'audit** immutable

---

## Etape 3 : Diagramme de Classes

> Voir diagramme : `docs/diagrammes/01_diagramme_classes.puml`

### 3.1 Entites du Domaine (ORM SQLAlchemy)

Les classes du domaine sont mappees directement sur les tables PostgreSQL via **SQLAlchemy ORM**. Chaque classe definit ses attributs, types, contraintes et relations.

### 3.2 Services Metier (Backend)

| Service | Responsabilite |
|---------|---------------|
| **TransactionSaga** | Orchestre les transferts avec pattern Saga (validate -> reserve -> execute -> complete/rollback) |
| **TontineEngine** | Gere le cycle de vie des tontines (creation, ajout membres, collecte, distribution) |
| **FraudDetectionEngine** | Analyse chaque transaction avec scoring ML + regles (0-100) |
| **EncryptionService** | Chiffrement AES-256-GCM des donnees sensibles (PII) |
| **NotificationService** | Envoi SMS (Twilio) et Email (SendGrid) |
| **CurrencyService** | Taux de change temps reel avec cache Redis (TTL 5 min) |

---

## Etape 4 : Cas d'Utilisation

> Voir diagramme : `docs/diagrammes/02_cas_utilisation.puml`

### 4.1 Acteurs du Systeme

| Acteur | Role | Perimetre |
|--------|------|-----------|
| **Client (Customer)** | Utilisateur final | Ses propres comptes/tontines |
| **Support L1** | Agent support niveau 1 | Consultation clients, tickets |
| **Support L2** | Agent support niveau 2 | Gel/degel comptes, remboursements |
| **Country Admin** | Administrateur pays | Gestion KYC, utilisateurs, rapports du pays |
| **Super Admin** | Administrateur global | Gestion tenants, audit global, analytics |

**Hierarchie :** Super Admin > Country Admin > Support L2 > Support L1 (heritage de permissions)

### 4.2 Cas d'Utilisation par Module

**Authentification & Securite (5 UC) :**
- S'inscrire, Se connecter (JWT + MFA), Activer MFA (TOTP), Modifier profil, Changer mot de passe

**Services Bancaires (6 UC) :**
- Ouvrir un compte, Consulter solde, Effectuer un virement, Deposer de l'argent, Consulter historique, Convertir devises

**Tontine - Epargne Collective (5 UC) :**
- Creer une tontine, Ajouter des membres, Demarrer la tontine, Declencher un cycle, Consulter les membres

**KYC - Conformite (2 UC) :**
- Soumettre document KYC, Verifier document KYC

**Support Client (6 UC) :**
- Creer un ticket, Chat en temps reel, Consulter un client, Geler un compte, Degeler un compte, Rembourser transaction

**Administration Pays (5 UC) :**
- Gerer les utilisateurs, Valider/Rejeter KYC, Consulter transactions, Generer rapports, Exporter rapports

**Super Administration (5 UC) :**
- Creer un tenant (pays), Gerer les tenants, Consulter audit logs, Analytics globaux, Configurer tenant

**Systeme Automatique (4 UC) :**
- Detecter fraude, Envoyer notifications, Journaliser audit, Chiffrer donnees PII

---

## Etape 5 : Securite et Conformite

### 5.1 Authentification

- **JWT (JSON Web Token)** avec expiration de 60 minutes
- Payload : user_id, email, role, tenant_id
- **MFA/2FA** via TOTP (compatible Google Authenticator)
- Hashage des mots de passe avec **bcrypt**

### 5.2 Controle d'Acces (RBAC Granulaire)

Systeme de permissions au format `ressource:action` :

```
tenants:create, tenants:read, tenants:update, tenants:delete
users:read, users:update, users:activate, users:deactivate
accounts:read, accounts:freeze, accounts:unfreeze, accounts:close
transactions:read, transactions:approve, transactions:refund
kyc:read, kyc:approve, kyc:reject
reports:generate, reports:export
audit:read, audit:export
config:write
```

Chaque role a un **scope** :
- `super_admin` : scope **GLOBAL** (tous les tenants)
- `country_admin` / `support` : scope **TENANT** (uniquement leur pays)

### 5.3 Detection de Fraude

Moteur hybride ML + regles heuristiques :
- **Feature engineering :** montant, heure, jour, velocite, distance, nouveau marchand
- **Score de risque (0-100) :**
  - LOW (0-70) : Transaction autorisee
  - MEDIUM (70-85) : Flag pour review manuel
  - HIGH (>85) : Blocage automatique + notification

### 5.4 Chiffrement des Donnees

- **AES-256-GCM** pour les donnees PII (informations personnelles)
- Derivation de cle via PBKDF2
- Format stocke : `iv:authTag:ciphertext` (base64)

### 5.5 Audit et Tracabilite

- **Logs immutables** pour chaque action critique
- Champs captures : user, IP, action, ressource, changements, timestamp
- Filtrable par tenant, role, action, periode
- Export possible pour conformite reglementaire

---

## Etape 6 : Moteur de Transactions (Saga Pattern)

### 6.1 Machine a Etats

```
INITIATED -> VALIDATED -> RESERVED -> EXECUTED -> COMPLETED
     |            |           |           |
     v            v           v           v
  FAILED      FAILED    ROLLED_BACK   ROLLED_BACK
```

### 6.2 Etapes du Virement

1. **INITIATED** : Creation de la demande de virement
2. **VALIDATED** : Verification des comptes source/destination, montant, devise
3. **RESERVED** : Reservation du montant (debit du solde disponible, ajout au pending)
4. **EXECUTED** : Execution effective (credit du beneficiaire)
5. **COMPLETED** : Confirmation et creation des ecritures comptables (2 LedgerEntry)

En cas d'erreur a n'importe quelle etape, un **rollback automatique** restaure le solde reserve.

### 6.3 Double-Entree Comptable

Chaque transaction produit exactement 2 ecritures :
- **DEBIT** sur le compte emetteur (montant negatif)
- **CREDIT** sur le compte recepteur (montant positif)

Cela garantit que `somme(DEBIT) + somme(CREDIT) = 0` a tout moment (integrite comptable).

---

## Etape 7 : Systeme de Tontine

### 7.1 Concept

La **tontine** est un systeme d'epargne collective traditionnel en Afrique de l'Ouest. Djembe Bank numerise ce processus.

### 7.2 Cycle de Vie

1. **Creation** : Un administrateur cree une tontine (nom, montant cible, frequence, methode de distribution)
2. **Ajout de membres** : Les utilisateurs rejoignent avec un montant de contribution
3. **Demarrage** : La tontine passe de "open" a "active" (minimum 2 membres)
4. **Cycle de collecte** : A chaque periode (hebdomadaire/mensuel), chaque membre contribue
5. **Distribution** : Le montant total est verse au beneficiaire du cycle
6. **Fin** : Une fois tous les membres servis, la tontine est "completed"

### 7.3 Methodes de Distribution

| Methode | Description |
|---------|------------|
| **Rotating** | Ordre fixe defini a l'inscription (membre 1, puis 2, puis 3...) |
| **Random** | Tirage aleatoire parmi les membres non encore servis |
| **Vote** | Les membres votent pour le prochain beneficiaire |

---

## Etape 8 : API REST (70+ Endpoints)

### 8.1 Architecture des Routes

L'API est organisee en 3 routeurs :
- **routes.py** : Endpoints utilisateurs (auth, comptes, transactions, tontines)
- **routes_admin.py** : Endpoints administration (super admin, country admin, support)
- **routes_chat.py** : Endpoints chat en temps reel

### 8.2 Endpoints Principaux

**Authentification (8 endpoints)**
```
POST /auth/register       - Inscription
POST /auth/login          - Connexion (retourne JWT)
GET  /auth/me             - Profil utilisateur courant
POST /auth/mfa/enable     - Activer 2FA
POST /auth/mfa/verify     - Verifier code TOTP
POST /auth/change-password - Changer mot de passe
```

**Services Bancaires (6 endpoints)**
```
POST /accounts            - Creer un compte
GET  /accounts            - Lister ses comptes
POST /accounts/{id}/deposit - Deposer de l'argent
POST /transfers           - Effectuer un virement
GET  /transactions        - Historique des transactions
```

**Tontines (4 endpoints)**
```
GET  /tontines            - Lister les tontines
POST /tontines            - Creer une tontine
POST /tontines/{id}/members - Ajouter un membre
GET  /tontines/{id}/members - Lister les membres
```

**Administration Super Admin (12+ endpoints)**
```
POST   /admin/tenants                 - Creer un tenant (pays)
GET    /admin/tenants/{id}/analytics  - Analytics par pays
GET    /admin/audit-logs              - Consulter les logs d'audit
PATCH  /admin/users/{id}              - Modifier un utilisateur
```

**Administration Country Admin (7 endpoints)**
```
GET  /admin/country/users         - Lister utilisateurs du pays
POST /admin/country/kyc/{id}/verify - Valider un document KYC
GET  /admin/country/transactions  - Transactions du pays
GET  /admin/country/reports       - Generer un rapport
```

**Support Agent (3+ endpoints)**
```
POST /support/accounts/{id}/freeze    - Geler un compte (L2)
POST /support/accounts/{id}/unfreeze  - Degeler un compte (L2)
POST /support/transactions/{id}/refund - Rembourser (L2)
```

### 8.3 Documentation Interactive

L'API dispose d'une documentation **Swagger UI** accessible a : `http://localhost:8000/docs`

---

## Etape 9 : Frontend Admin Dashboard

### 9.1 Technologies

- **React 18** + **TypeScript** : UI moderne et typee
- **Material-UI (MUI)** : Composants visuels professionnels
- **TanStack Query** : Gestion du cache et des requetes API
- **React Router** : Navigation SPA
- **Recharts** : Graphiques et visualisations
- **i18next** : Internationalisation (Francais/Anglais)

### 9.2 Pages du Dashboard

| Page | Fonctionnalite |
|------|---------------|
| **Login** | Connexion avec tenant code + MFA |
| **Dashboard** | KPIs, graphiques, statistiques temps reel |
| **Utilisateurs** | Liste, creation, activation/desactivation |
| **Comptes** | Liste, gel/degel, cloture |
| **Transactions** | Historique, filtres, remboursement |
| **Tontines** | Creation, gestion membres, declenchement cycles |
| **KYC** | Verification documents d'identite |
| **Support** | Tickets, chat en temps reel |
| **Audit Logs** | Journal d'audit immutable |
| **Rapports** | Generation et export (Excel/CSV/PDF) |
| **Tenants** | Gestion des pays (Super Admin) |
| **Devises** | Taux de change et conversion |
| **Notifications** | Envoi SMS/Email |
| **Parametres** | Profil et mot de passe |

---

## Etape 10 : Notifications Temps Reel (WebSocket)

### 10.1 Architecture

- **Serveur WebSocket** standalone (port 8080)
- Communication via **Redis Pub/Sub** avec l'API backend
- Authentification JWT via query param

### 10.2 Evenements Diffuses

| Evenement | Declencheur |
|-----------|------------|
| `transaction.completed` | Un virement est termine |
| `account.updated` | Solde modifie |
| `notification.new` | Nouvelle alerte |
| `chat.message` | Nouveau message de support |
| `chat.typing` | Indicateur de saisie |

---

## Architecture Technique Globale

> Voir diagramme : `docs/diagrammes/04_architecture_technique.puml`

```
[Navigateur Web]
     |
     |-- REST API (HTTPS) --> [FastAPI Core Service - Port 8000]
     |                            |-- SQL --> [PostgreSQL 15 - Port 5432]
     |                            |-- Cache --> [Redis 7.2 - Port 6379]
     |                            |-- Events --> [Kafka - Port 9092]
     |
     |-- WebSocket (WSS) --> [WebSocket Server - Port 8080]
                                  |-- Pub/Sub --> [Redis]
```

---

## Diagrammes Disponibles

Tous les diagrammes sont au format **PlantUML** et peuvent etre rendus via :
- https://www.plantuml.com/plantuml/uml/ (editeur en ligne)
- Extension VS Code "PlantUML"
- Ligne de commande : `java -jar plantuml.jar fichier.puml`

| Fichier | Type de Diagramme |
|---------|-------------------|
| `docs/diagrammes/01_diagramme_classes.puml` | Diagramme de Classes UML |
| `docs/diagrammes/02_cas_utilisation.puml` | Diagramme de Cas d'Utilisation |
| `docs/diagrammes/03_MCD.puml` | Modele Conceptuel de Donnees (MCD) |
| `docs/diagrammes/04_architecture_technique.puml` | Architecture Technique |

---

## Informations de Connexion (Dev)

| Service | URL |
|---------|-----|
| API Backend | http://localhost:8000 |
| Swagger (Documentation API) | http://localhost:8000/docs |
| Frontend Admin | http://localhost:3000 |
| WebSocket | ws://localhost:8080 |

**Compte Admin de test :**
- Email : `admin@djembe-bank.com`
- Mot de passe : `Admin123!`
- Tenant : `SN` (Senegal)

---

## Conclusion

Djembe Bank est une plateforme bancaire complete qui couvre :

1. **Multi-tenancy** : Isolation par pays avec schema PostgreSQL dedie
2. **Services bancaires** : Comptes, virements, double-entree comptable
3. **Innovation africaine** : Numerisation des tontines traditionnelles
4. **Securite** : JWT + MFA, RBAC granulaire, chiffrement AES-256, detection fraude
5. **Conformite** : KYC, audit immutable, tracabilite complete
6. **Administration** : 4 niveaux d'acces (Super Admin, Country Admin, Support L1/L2)
7. **Temps reel** : WebSocket pour notifications instantanees
8. **70+ endpoints API** documentes via Swagger

Le projet est conteneurise avec **Docker Compose** (7 services) et pret pour un deploiement en production sur une infrastructure cloud (AWS/Kubernetes).

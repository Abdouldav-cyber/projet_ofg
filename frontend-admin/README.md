# Djembé Bank - Interface d'Administration

Interface d'administration pour la plateforme bancaire multi-tenant Djembé Bank.

## 📋 Prérequis

- Node.js 18+ et npm (ou yarn/pnpm)
- Backend API Djembé Bank en cours d'exécution (port 8000)
- WebSocket serveur en cours d'exécution (port 8080)

## 🚀 Installation

1. **Installer les dépendances**

```bash
cd frontend-admin
npm install
```

2. **Configurer les variables d'environnement**

Copier le fichier `.env.example` vers `.env`:

```bash
cp .env.example .env
```

Modifier les URLs si nécessaire:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8080
```

3. **Lancer en mode développement**

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## 🏗️ Structure du Projet

```
frontend-admin/
├── public/                 # Fichiers statiques
├── src/
│   ├── components/        # Composants réutilisables
│   │   ├── Layout/       # Composants de mise en page
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── index.tsx
│   │   └── PrivateRoute.tsx
│   ├── contexts/         # Contextes React
│   │   ├── AuthContext.tsx
│   │   └── WebSocketContext.tsx
│   ├── i18n/            # Internationalisation
│   │   ├── locales/
│   │   │   ├── fr.json
│   │   │   └── en.json
│   │   └── index.ts
│   ├── pages/           # Pages de l'application
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── Dashboard/
│   │   ├── users/
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── kyc/
│   │   ├── tontines/
│   │   ├── support/
│   │   ├── reports/
│   │   ├── audit/
│   │   ├── settings/
│   │   └── tenants/
│   ├── services/        # Services API
│   │   └── api.ts
│   ├── theme/          # Configuration Material-UI
│   │   └── index.ts
│   ├── types/          # Types TypeScript
│   │   └── index.ts
│   ├── App.tsx         # Composant principal
│   └── main.tsx        # Point d'entrée
├── .env.example        # Exemple de configuration
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🔐 Connexion

Pour vous connecter, utilisez les identifiants suivants (selon votre environnement):

**Super Admin:**
- Email: `admin@djembe-bank.com`
- Password: `SuperAdmin@2025`
- Code Pays: `SN`

**Country Admin (Sénégal):**
- Email: `admin.senegal@djembe-bank.com`
- Password: `Admin@2025`
- Code Pays: `SN`

**Support L2:**
- Email: `support@djembe-bank.com`
- Password: `Support@2025`
- Code Pays: `SN`

> ⚠️ **Note MFA:** Si l'authentification MFA est activée, vous aurez besoin de votre code TOTP depuis votre application d'authentification.

## 🎨 Technologies Utilisées

### Frontend
- **React 18** - Framework JavaScript
- **TypeScript** - Typage statique
- **Material-UI (MUI)** - Bibliothèque de composants
- **React Router** - Routing
- **TanStack Query** - Gestion d'état serveur
- **Axios** - Client HTTP
- **Recharts** - Graphiques
- **i18next** - Internationalisation
- **React Hook Form** - Gestion de formulaires
- **Zod** - Validation de schémas

### Développement
- **Vite** - Build tool
- **ESLint** - Linting
- **TypeScript ESLint** - Linting TypeScript

## 📦 Scripts Disponibles

```bash
# Lancer en développement
npm run dev

# Compiler pour la production
npm run build

# Prévisualiser le build de production
npm run preview

# Linter le code
npm run lint
```

## 🌍 Internationalisation

L'application supporte le français et l'anglais. Les traductions se trouvent dans:
- `src/i18n/locales/fr.json` (Français)
- `src/i18n/locales/en.json` (English)

Pour changer de langue, utilisez le contexte i18next:

```typescript
import { useTranslation } from 'react-i18next'

const { t, i18n } = useTranslation()
i18n.changeLanguage('en') // Changer vers l'anglais
```

## 🔌 Connexion WebSocket

L'application se connecte automatiquement au serveur WebSocket pour recevoir des notifications en temps réel:

- **Transactions complétées**
- **Mises à jour de comptes**
- **Nouvelles notifications**

Le statut de connexion est affiché dans le header (point vert/rouge).

## 🛡️ Permissions et Rôles

L'application gère 4 niveaux d'administration:

### 1. Super Admin (`super_admin`)
- **Permissions:** Toutes (`*`)
- **Accès:** Global (tous les pays)
- **Fonctionnalités:**
  - Gestion des tenants (pays)
  - Gestion des utilisateurs cross-tenant
  - Accès aux logs d'audit globaux
  - Configuration système

### 2. Country Admin (`country_admin`)
- **Permissions:** `users:read,update`, `kyc:approve,reject`, `reports:generate`, etc.
- **Accès:** Limité à leur tenant
- **Fonctionnalités:**
  - Gestion des utilisateurs du pays
  - Validation KYC
  - Génération de rapports
  - Consultation des transactions

### 3. Support L1 (`support_l1`)
- **Permissions:** `users:read`, `transactions:read`, `tickets:update`
- **Accès:** Lecture seule + tickets
- **Fonctionnalités:**
  - Consultation des utilisateurs
  - Consultation des transactions
  - Gestion des tickets support

### 4. Support L2 (`support_l2`)
- **Permissions:** `accounts:freeze,unfreeze`, `transactions:refund`
- **Accès:** Actions avancées
- **Fonctionnalités:**
  - Gel/dégel de comptes
  - Remboursements
  - Gestion des tickets support

## 📡 API

L'application communique avec le backend via:

- **Base URL:** `http://localhost:8000` (configurable via `VITE_API_URL`)
- **Authentification:** JWT Bearer token
- **Header Tenant:** `X-Tenant-Code` (code pays: SN, CI, GH, etc.)

### Endpoints principaux

```typescript
// Authentification
POST /api/v1/auth/login
POST /api/v1/auth/verify-mfa
GET /api/v1/auth/me

// Utilisateurs
GET /api/v1/users
GET /api/v1/users/{id}
PATCH /api/v1/users/{id}

// Comptes
GET /api/v1/accounts
POST /admin/accounts/{id}/freeze
POST /admin/accounts/{id}/unfreeze

// Transactions
GET /api/v1/transactions
POST /admin/transactions/{id}/refund

// KYC
GET /admin/country/kyc
POST /admin/country/kyc/{id}/approve
POST /admin/country/kyc/{id}/reject

// Dashboard
GET /admin/country/analytics

// Tenants (Super Admin)
GET /admin/tenants
POST /admin/tenants
```

## 🧪 Tests

Pour tester l'application:

1. Assurez-vous que le backend est en cours d'exécution
2. Créez des utilisateurs de test avec différents rôles
3. Testez les différentes fonctionnalités selon les permissions

## 🚧 État Actuel du Développement

### ✅ Complété
- Configuration du projet (TypeScript, Vite, ESLint)
- Structure de base des dossiers
- Système d'authentification (login, MFA)
- Contextes (Auth, WebSocket)
- Layout (Header, Sidebar)
- Page Dashboard avec statistiques et graphiques
- Service API avec intercepteurs
- Internationalisation (FR/EN)
- Système de permissions RBAC
- Theme Material-UI personnalisé

### 🚧 En développement
- Pages de gestion détaillées:
  - Utilisateurs (liste, création, édition)
  - Comptes (liste, actions)
  - Transactions (liste, filtres, remboursements)
  - KYC (validation de documents)
  - Tontines (gestion complète)
  - Support (tickets)
  - Rapports (génération, export)
  - Audit logs (consultation)
  - Paramètres
  - Tenants (Super Admin)

### 📋 Fonctionnalités à ajouter
- Tableaux avec tri, filtrage et pagination
- Formulaires de création/édition
- Modales de confirmation
- Gestion des fichiers (upload KYC)
- Export de données (CSV, Excel, PDF)
- Notifications push
- Mode sombre
- Tests unitaires et d'intégration

## 📝 Notes de développement

### Gestion des erreurs

Les erreurs API sont gérées automatiquement:
- **401 Unauthorized:** Redirection vers `/login`
- **403 Forbidden:** Affichage message "Accès refusé"
- **Autres erreurs:** Affichage dans une snackbar

### Gestion du cache

TanStack Query gère le cache automatiquement:
- **Stale time:** 5 minutes
- **Refetch on window focus:** Désactivé
- **Retry:** 1 tentative

### Responsive Design

L'interface est responsive:
- **Desktop:** Sidebar permanente
- **Mobile/Tablet:** Sidebar temporaire (drawer)

## 🤝 Contribution

Pour contribuer au projet:

1. Créer une branche feature: `git checkout -b feature/ma-fonctionnalite`
2. Commiter les changements: `git commit -m "Ajout de ma fonctionnalité"`
3. Pousser la branche: `git push origin feature/ma-fonctionnalite`
4. Créer une Pull Request

## 📄 Licence

Projet propriétaire Djembé Bank © 2025

---

**Développé avec ❤️ pour Djembé Bank**

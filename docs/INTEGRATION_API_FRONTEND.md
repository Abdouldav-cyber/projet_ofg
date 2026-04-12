# 🚀 Guide d'Intégration API : Frontend Web & Mobile (Djembé Bank)

Ce document décrit comment intégrer facilement l'API Core de Djembé Bank dans une application Web (React/Next.js) et Mobile (Flutter/React Native).

## 1. Concepts Clés de l'API Djembé Bank

L'infrastructure backend repose sur deux concepts fondamentaux :
1. **Multi-Tenancy (Isolation par pays) :** Le backend s'attend à savoir depuis quel "pays" vous vous connectez (ex: `tenant_sn` pour le Sénégal, `tenant_ci` pour la Cöte d'Ivoire). Cela se passe par l'en-tête HTTP `X-Tenant-Code`.
2. **Sécurité JWT :** Toutes les requêtes protégées exigent un token transmis via l'en-tête `Authorization: Bearer <TOKEN>`.

### URL de base
- **Local :** `http://localhost:8000/api/v1`
- **Docs Swagger :** `http://localhost:8000/docs`

---

## 2. Configuration Globale (Intercepteurs)

Pour éviter de répéter l'injection des Tokens et des codes Pays à chaque appel, configurez un **intercepteur HTTP**.

### 💻 Pour le Web (React / JS avec Axios)
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour injecter le token et le tenant
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  const tenant = localStorage.getItem('tenant_code') || 'tenant_ci'; // CI par défaut

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Important : Transmission du Pays
  config.headers['X-Tenant-Code'] = tenant;
  
  return config;
});

export default api;
```

### 📱 Pour le Mobile (Flutter avec la librairie HTTP ou Dio)
```dart
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static final Dio dio = Dio(BaseOptions(
    baseUrl: 'http://10.0.2.2:8000/api/v1', // 10.0.2.2 pour Android Emulator local
    contentType: 'application/json',
  ));

  static void initialize() {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('access_token');
        final tenant = prefs.getString('tenant_code') ?? 'tenant_ci';

        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        options.headers['X-Tenant-Code'] = tenant;

        return handler.next(options);
      },
    ));
  }
}
```

---

## 3. Flux d'Authentification (Login)

### Format attendu par le backend
Le backend utilise la norme `OAuth2PasswordRequestForm`. Il s'attend à recevoir la data sous forme de **FormData (`application/x-www-form-urlencoded`)** et non pas en JSON pur !

### 💻 Exemple d'intégration (Web/React)
```typescript
export const login = async (email, password, countryCode) => {
  try {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    // Le backend utilise optionnellement client_id comme fallback pour le tenant
    formData.append('client_id', countryCode); 

    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Tenant-Code': countryCode
      }
    });

    // Sauvegarde en cache local
    localStorage.setItem('access_token', response.data.access_token);
    localStorage.setItem('tenant_code', response.data.tenant_code);
    
    return response.data;
  } catch (error) {
    console.error("Erreur de connexion", error);
    throw error;
  }
};
```

---

## 4. Consommation des Modules Métiers

Une fois l'intercepteur défini, l'appel aux API métiers devient extrêmement simple.

### A. Récupérer les Comptes & Soldes
```typescript
// GET /accounts
export const fetchMyAccounts = async () => {
  const response = await api.get('/accounts');
  return response.data; // Retourne un Array: [{id, account_type, status, currency...}]
};
```

### B. Moteur des Tontines
Pour afficher les tontines au client :
```typescript
// GET /tontines
export const fetchTontines = async () => {
  const response = await api.get('/tontines');
  return response.data;
};

// POST /tontines/{tontine_id}/members
export const joinTontine = async (tontineId, userId) => {
  const response = await api.post(`/tontines/${tontineId}/members`, {
    user_id: userId
  });
  return response.data;
};
```

### C. Portefeuille Micro-Investissements
C'est le module nouvellement intégré. Swagger retourne des schémas précis pour la modélisation côté client.
```typescript
// Définition de typage Typescript (Optionnel mais recommandé)
interface ClientInvestment {
    id: string;
    project_title: string;
    invested_amount: number;
    expected_yield: number;
    project_annual_yield: number;
}

// GET /client/investments/my-portfolio
export const getMyPortfolio = async (): Promise<ClientInvestment[]> => {
  const response = await api.get('/client/investments/my-portfolio');
  return response.data; 
};

// POST /client/investments/projects/{id}/invest
export const investInProject = async (projectId: string, amount: number) => {
  const response = await api.post(`/client/investments/projects/${projectId}/invest`, {
    amount: amount
  });
  return response.data;
};
```

### D. Initier un Virement (Avec gestion des Erreurs de Fraude)
L'API intègre le blocage des transactions par Deep Learning. Il faut gérer les erreurs 403 côté frontend (ex: Afficher une SweetAlert).

```typescript
export const transferMoney = async (fromAccount, toAccount, amount) => {
  try {
    const response = await api.post('/transfers', {
      from_account_id: fromAccount,
      to_account_id: toAccount,
      amount: amount,
      currency: "XOF",
      reference: "Paiement de test"
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 403) {
      // Code 403 => Blocage par le système Anti-Fraude
      alert("Blocage de Sécurité: " + error.response.data.detail);
    } else {
      alert("Erreur serveur ou solde insuffisant");
    }
  }
};
```

### E. Gestion du Support Client (Ticketing & L2)
Le module Support vu dans le Swagger se divise en deux usages stricts :

**1. Pour les Développeurs App Client (Web B2C / Mobile) :**
L'application finale de l'utilisateur ne doit consommer que les routes de base pour soumettre et consulter ses propres réclamations. L'API filtre automatiquement pour ne renvoyer que les données de l'utilisateur connecté via le token JWT.
```typescript
// Récupérer la liste des tickets de l'utilisateur
export const getMyTickets = async () => {
  const response = await api.get('/support/tickets');
  return response.data;
};

// Ouvrir une nouvelle réclamation
export const createTicket = async (subject, message) => {
  const response = await api.post('/support/tickets', {
    subject: subject,
    message: message
  });
  return response.data;
};
```

**2. Pour les Développeurs Dashboard Admin (Support L2 & Agents) :**
Les autres endpoints, et **particulièrement ceux de la section "Support L2"** (`freeze`, `unfreeze`, `refund`), sont réservés au back-office d'administration. Ils nécessitent des rôles élevés (RBAC) pour geler un compte compromis ou rembourser une transaction bloquée.
**Ne branchez PAS ces requêtes côté mobile/client.**
```typescript
// [DASHBOARD SEULEMENT] Geler un compte suite à suspicion de fraude
export const freezeUserAccount = async (accountId) => {
  try {
    const response = await api.post(`/support/accounts/${accountId}/freeze`);
    alert("Compte gelé avec succès.");
  } catch(e) {
    alert("Droit insuffisant ou compte introuvable.");
  }
};
```

---

## 5. Bonnes Pratiques UI/UX
- **Loaders (Spinners) :** Toujours afficher un indicateur de chargement et verrouiller les boutons pendant les appels `POST` (ex: pendant l'investissement afin d'éviter les doubles clics).
- **SweetAlert2 (Web) / Snackbars (Mobile) :** Remplacer les alertes par défaut du navigateur par des toasts élégants pour confirmer le succès des transactions ou des dépôts.
- **Pull-to-Refresh (Mobile) :** Sur l'écran Dashboard / Portefeuille, utilisez un widget Pull-To-Refresh qui rappelle `fetchMyAccounts()` ou `getMyPortfolio()` pour actualiser le solde.
- **Stockage Sécurisé (Mobile) :** Sur iOS/Android, préférez `FlutterSecureStorage` au lieu de `SharedPreferences` pour le stockage du `access_token` JWT.

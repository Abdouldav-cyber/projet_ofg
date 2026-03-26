# Diagrammes de Conception - Djembé Bank Core API

Afin d'appuyer votre présentation, voici les deux schémas architecturaux générés au format **Mermaid**. 

> 💡 **Comment les utiliser ?**
> La majorité des éditeurs modernes (sur VS Code, GitHub, GitLab ou Notion) afficheront ces graphes automatiquement. Sinon, vous pouvez copier/coller ces blocs de code sur le site gratuit **[Mermaid Live Editor](https://mermaid.live/)** pour les télécharger directement en image (PNG/SVG) à coller dans votre PowerPoint.

---

## 1. Diagramme de Cas d'Utilisation (Use Case)

Ce diagramme illustre le **Système de Permissions (RBAC)** et prouve la ségrégation des fonctions d'Administration.

```mermaid
flowchart LR
    %% Acteurs
    SA((Super Admin \n Global HQ))
    CA((Country Admin \n Pays))
    SUP((Support Agent \n L1/L2))
    CLI((Client Final \n Utilisateur))

    %% Système Djembé Bank
    subgraph "Djembé Bank Core API"
        direction TB
        UC1(Créer un nouveau Pays/Tenant)
        UC2(Voir les Audit Logs Globaux)
        
        UC3(Valider les Documents KYC)
        UC4(Générer Rapports d'Activité Pays)
        
        UC5(Geler / Dégeler un Compte)
        UC6(Rembourser une Transaction)
        UC10(Gérer les Tickets & Chat en direct)
        
        UC7(Ouvrir un Compte Bancaire)
        UC8(Effectuer un Virement)
        UC9(Créer ou Rejoindre une Tontine)
    end

    %% Relations Administratives
    SA ---> UC1
    SA ---> UC2
    SA -.->|Peut aussi| CA
    
    CA ---> UC3
    CA ---> UC4
    CA -.->|Peut aussi| SUP
    
    SUP ---> UC5
    SUP ---> UC6
    SUP ---> UC10
    
    %% Relations Client
    CLI ---> UC7
    CLI ---> UC8
    CLI ---> UC9

    style SA fill:#ff9999,stroke:#333,stroke-width:2px
    style CA fill:#ffcc99,stroke:#333,stroke-width:2px
    style SUP fill:#ffff99,stroke:#333,stroke-width:2px
    style CLI fill:#99ccff,stroke:#333,stroke-width:2px
```

---

## 2. Diagramme de Classe (Base de Données / Modèles)

Ce diagramme illustre la solidité de votre moteur bancaire, incluant le `LedgerEntry` (Double-entry bookkeeping) et la `Tontine`.

```mermaid
classDiagram
    class Tenant {
        +UUID id
        +String country_code
        +String regulatory_authority
        +JSONB config
        +String status
    }

    class User {
        +UUID id
        +String email
        +String role
        +String kyc_status
        +Boolean mfa_enabled
        +String password_hash
    }

    class Account {
        +UUID id
        +String account_type
        +String iban
        +String status
        +JSONB daily_limit
    }

    class AccountBalance {
        +String currency
        +Decimal available
        +Decimal pending
    }

    class Transaction {
        +UUID id
        +Decimal amount
        +String currency
        +String transaction_type
        +String status
    }

    class LedgerEntry {
        +UUID id
        +String entry_type (DEBIT/CREDIT)
        +Decimal amount
        +Decimal balance_after
    }

    class Tontine {
        +UUID id
        +String name
        +Decimal target_amount
        +String frequency
    }

    class AuditLog {
        +UUID log_id
        +String action
        +String resource_type
        +JSONB changes
        +String ip_address
    }

    %% Relations structurelles Multi-Tenant
    Tenant "1" -- "*" User : héberge (par schéma)
    Tenant "1" -- "*" AuditLog : trace (Sécurité)

    %% Relations Client
    User "1" -- "*" Account : possède
    User "1" -- "*" Tontine : crée / administre

    %% Relations Bancaires
    Account "1" -- "*" AccountBalance : possède
    Account "1" -- "*" Transaction : émet / recoit
    
    %% Sécurité Financière Immuable
    Transaction "1" -- "2" LedgerEntry : génère
```

---

## 3. Modélisation Physique de Données (MPD - ER Diagram)

Ce diagramme Entité-Relation détaille la structure exacte des tables PostgreSQL, leurs types de données (UUID, JSONB, NUMERIC) et les clés primaires/étrangères (PK/FK).

```mermaid
erDiagram
    TENANTS {
        UUID id PK
        VARCHAR(2) country_code
        VARCHAR(100) name
        VARCHAR(50) regulatory_authority
        JSONB config
        VARCHAR(20) status
        TIMESTAMP created_at
    }

    USERS {
        UUID id PK
        UUID tenant_id FK
        VARCHAR(100) email
        VARCHAR(255) password_hash
        VARCHAR(50) role
        VARCHAR(20) kyc_status
        BOOLEAN mfa_enabled
        TIMESTAMP created_at
    }

    ACCOUNTS {
        UUID id PK
        UUID user_id FK
        UUID tenant_id FK
        VARCHAR(50) account_type
        VARCHAR(34) iban
        VARCHAR(20) status
        NUMERIC daily_limit
        TIMESTAMP created_at
    }

    ACCOUNT_BALANCES {
        UUID account_id PK, FK
        VARCHAR(3) currency PK
        NUMERIC available
        NUMERIC pending
        TIMESTAMP updated_at
    }

    TRANSACTIONS {
        UUID id PK
        UUID from_account_id FK
        UUID to_account_id FK
        NUMERIC amount
        VARCHAR(3) currency
        VARCHAR(20) status
        VARCHAR(50) transaction_type
        VARCHAR(100) reference
        TIMESTAMP created_at
    }

    LEDGER_ENTRIES {
        UUID id PK
        UUID account_id FK
        UUID transaction_id FK
        VARCHAR(10) entry_type
        NUMERIC amount
        VARCHAR(3) currency
        NUMERIC balance_after
        TIMESTAMP created_at
    }

    TONTINES {
        UUID id PK
        UUID creator_id FK
        VARCHAR(100) name
        NUMERIC target_amount
        VARCHAR(20) cycle_frequency
        TIMESTAMP created_at
    }

    TONTINE_MEMBERS {
        UUID tontine_id PK, FK
        UUID user_id PK, FK
        VARCHAR(20) status
        NUMERIC contribution_amount
        TIMESTAMP joined_at
    }

    AUDIT_LOGS {
        UUID log_id PK
        TIMESTAMP timestamp
        UUID user_id FK
        VARCHAR(255) user_email
        INET ip_address
        VARCHAR(100) action
        VARCHAR(50) resource_type
        UUID resource_id
        JSONB changes
        JSONB metadata
    }

    %% Relations (Cardinalités)
    TENANTS ||--o{ USERS : "héberge"
    TENANTS ||--o{ ACCOUNTS : "possède"
    
    USERS ||--o{ ACCOUNTS : "détient"
    USERS ||--o{ TONTINES : "crée"
    USERS ||--o{ TONTINE_MEMBERS : "participe"
    USERS ||--o{ AUDIT_LOGS : "génère"
    
    ACCOUNTS ||--o| ACCOUNT_BALANCES : "contient"
    ACCOUNTS ||--o{ TRANSACTIONS : "envoie / recoit"
    ACCOUNTS ||--o{ LEDGER_ENTRIES : "enregistre"
    
    TRANSACTIONS ||--|{ LEDGER_ENTRIES : "produit"
    
    TONTINES ||--|{ TONTINE_MEMBERS : "comprend"
```

---
### 💡 Points clés pour votre speech :
*   **Sur le Diagramme de Cas d'Utilisation** : Mettez en avant le modèle RBAC (Role-Based Access Control). Un agent support ne peut *voir* que son pays. Seul le *Super Admin* a la vue globale.
*   **Sur le Diagramme de Classes** : Appuyez sur la relation `Transaction -> LedgerEntry`. C'est l'argument ultime pour rassurer les banques et régulateurs sur la traçabilité comptable parfaite du système (Double Entry Bookkeeping).
*   **Sur le MPD (Modélisation Physique de Données)** : Montrez que vous utilisez des `UUID` pour la sécurité (pas d'ID séquentiels facilement devinables), des `NUMERIC` pour l'argent (pour éviter les bugs de virgule flottante) et du `JSONB` pour de la souplesse sur les logs et configurations.

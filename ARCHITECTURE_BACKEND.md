# 🏛️ Architecture Backend & Dictionnaire des Données : Djembé Bank

Ce document exhaustif détaille l'intégralité des entités de modélisation (Base de données PostgreSQL via SQLAlchemy) utilisées dans le système `core-service` de l'API Djembé Bank. 

L'architecture repose sur un modèle **Multi-Tenant SaaS**, où le noyau *Core* gère la configuration globale, et chaque pays possède son propre schéma de données rigoureusement isolé.

---

## 🌍 1. Architecture Core (Niveau Global)

### L'entité `Tenant` (Le Pays)
C'est la clé de voûte du système d'isolation de la banque.
*   **Description** : Représente de façon unique un pays ou une filiale (ex: Djembé Sénégal, Djembé France).
*   **Rôle Technique** : Détermine le contexte d'exécution d'une requête HTTP (via le header `X-Tenant-Code`).
*   **Attributs principaux** :
    *   `country_code` : Identifiant unique du pays (ex: SN, FR, CI).
    *   `regulatory_authority` : Nom de l'autorité financière de tutelle locale.
    *   `base_currency` : Devise de référence locale (ex: XOF, EUR).
    *   `config` : Objet JSON dynamique permettant de stocker une configuration spécifique au pays sans modifier le code source.

---

## 👤 2. Gestion des Utilisateurs & Conformité

### L'entité `User` (Le Client / L'Agent)
*   **Description** : Modèle central représentant toute personne interagissant avec la banque (Client final, Agent de support, Administrateur).
*   **Attributs principaux** :
    *   `email` / `phone` : Identifiants de connexion et de contact.
    *   `password_hash` : Hachage hautement sécurisé du mot de passe (ne jamais stocker en clair).
    *   `role` : Niveau d'habilitation RBAC (customer, admin, support...).
    *   `kyc_status` : Statut critique de vérification d'identité légale (pending, approved, rejected).
    *   `is_active` : Booléen permettant la désactivation instantanée d'un compte (blacklist).

### L'entité `KYCDocument` (Géré dynamiquement)
*   **Description** : Registre des pièces justificatives liées à l'utilisateur (CNI, Passeport, Justificatif de domicile).
*   **Processus** : Les documents sont téléchargés à l'inscription, passent au statut *pending*, puis sont étudiés manuellement par les *Country Admins*.

---

## 💰 3. Moteur Bancaire & Ledger (Comptabilité Complète)

Ce module est le plus sensible du système. Il fonctionne sur le principe de la comptabilité en partie double.

### L'entité `Account` (Le Compte Bancaire)
*   **Description** : L'enveloppe physique des fonds d'un utilisateur.
*   **Attributs principaux** :
    *   `account_type` : Type de produit (personal, savings, business, tontine...).
    *   `iban` & `bic` : Identifiants bancaires standards internationaux.
    *   `daily_limit` & `monthly_limit` : Plafonds de sécurité (Anti-fraude de premier niveau).
    *   `status` : active, frozen (en cas de suspicion sévère de fraude), closed.

### L'entité `AccountBalance` (Le Solde)
*   **Description** : Image immédiate de la trésorerie disponible. Devrait toujours correspondre à la somme du Ledger.
*   **L'Astuce Technique** : Les valeurs monétaires (`available`, `pending`) sont stockées au format **JSON/String decimal** pour garantir une précision mathématique absolue (contournant ainsi les bugs historiques d'arrondis des bases de données).

### L'entité `Transaction` (Le Flux)
*   **Description** : Trace métier globale d'un transfert financier, qu'il soit interne ou externe.
*   **Attributs principaux** :
    *   `from_account_id` / `to_account_id` : Comptes émetteur et bénéficiaire.
    *   `amount` / `currency` : Valeur exacte et devise du mouvement.
    *   `transaction_type` : interne, international, p2p, refund.
    *   `status` : pending (en attente du moteur de fraude), completed (validé), failed (refusé), reversed (annulé).

### L'entité `LedgerEntry` (Le Grand Livre Immuable)
*   **Description** : Le saint Graal comptable de Djembé Bank (Double-Entry Bookkeeping).
*   **La Règle d'or** : Cette table est fonctionnellement **Totalement Immuable** (Append-Only). Chaque ligne insérée détaille soit un mouvement `CREDIT`, soit un `DEBIT`.
*   **Objectif** : Aucune donnée n'y est jamais modifiée ou supprimée, assurant une parfaite auditabilité pour les régulateurs financiers.

---

## 🤝 4. L'Innovation : Les "Tontines" (Épargne Collective)

C'est le module différenciateur de Djembé Bank vis-à-vis des banques traditionnelles occidentales.

### L'entité `Tontine` (Le Cercle)
*   **Description** : L'espace d'épargne.
*   **Attributs principaux** :
    *   `target_amount` : L'objectif financier commun du cercle.
    *   `frequency` : Périodicité du paiement (ex: weekly, monthly).
    *   `distribution_method` : Règle d'attribution de la cagnotte finale (rotating, random, vote).

### L'entité `TontineMember` (Le Participant)
*   **Description** : Modélise la jointure entre un participant `User` et une `Tontine`.
*   **Attributs principaux** :
    *   `contribution_amount` : L'engagement financier individuel et régulier du membre.
    *   `order` : Sa position programmée dans la file d'attente pour récupérer la cagnotte globale (si la méthode est "rotating").

### L'entité `TontineCycle` (L'Historique)
*   **Description** : Registre historique de chaque rétribution (levée) réussie.
*   **Utilité Métier** : Permet au système de savoir très exactement quel utilisateur a reçu l'argent (`recipient_user_id`), quel montant, et à quel cycle, pour gérer la suite logique de la Tontine.

---

## 🎧 5. Service Client & Back-Office (CRM Intégré)

### L'entité `SupportTicket` (Le Centre d'Assistance)
*   **Description** : Système de ticketing interne permettant de suivre chaque plainte/demande.
*   **Attributs principaux** :
    *   `assigned_to` : L'agent support en charge de la résolution.
    *   `category` & `priority` : Typologie métier du ticket (urgent, account_fraud, kyc_issue...).
    *   `status` : Cycle de vie (open, in_progress, resolved).
    *   `resolution` : Trace écrite de la conclusion apportée au client.

### L'entité `ChatMessage` (La Conversation)
*   **Description** : Les messages échangés de façon asynchrone dans un `SupportTicket`.
*   **Attributs principaux** :
    *   `sender_role` : Permet d'identifier si le message vient du *customer* ou du *support_l1/l2*.
    *   `message_type` : text, image, file (permet l'envoi de preuves supplémentaires, ex: capture d'écran de l'erreur).

---

## 🔒 6. Transparence, Conformité et Sécurité Légale

### L'entité `AuditLog` (Le Registre de Sécurité Bancaire)
*   **Description** : Le registre inaltérable et exhaustif de la conformité.
*   **Fonctionnement Absolu** : Absolument chaque action critique réalisée sur la plateforme (connexion, gel d'un compte client, élévation de privilèges, validation KYC, remboursement forcé) génère une entrée automatique dans cette table.
*   **Traces conservées** : L'ID de l'acteur (`user_id`), son `IP`, l'action précise effectuée (`action`), la table modifiée (`resource`), et même la différence des champs (`details`).
*   **Conclusion** : C'est ce fichier qui permet à Djembé Bank d'obtenir et de conserver ses licences d'exploitation auprès de la BCEAO ou autre autorité compétente.

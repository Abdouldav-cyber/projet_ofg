"""
Système de permissions granulaires RBAC pour Djembé Bank
Définit les rôles et permissions avec pattern resource:action
"""
from typing import List, Dict, Optional
from enum import Enum


class Permission(str, Enum):
    """Énumération des permissions disponibles"""
    # Tenants
    TENANTS_CREATE = "tenants:create"
    TENANTS_READ = "tenants:read"
    TENANTS_UPDATE = "tenants:update"
    TENANTS_DELETE = "tenants:delete"
    TENANTS_ALL = "tenants:*"

    # Users
    USERS_CREATE = "users:create"
    USERS_READ = "users:read"
    USERS_UPDATE = "users:update"
    USERS_DELETE = "users:delete"
    USERS_ACTIVATE = "users:activate"
    USERS_DEACTIVATE = "users:deactivate"
    USERS_ALL = "users:*"

    # Accounts
    ACCOUNTS_CREATE = "accounts:create"
    ACCOUNTS_READ = "accounts:read"
    ACCOUNTS_UPDATE = "accounts:update"
    ACCOUNTS_DELETE = "accounts:delete"
    ACCOUNTS_FREEZE = "accounts:freeze"
    ACCOUNTS_UNFREEZE = "accounts:unfreeze"
    ACCOUNTS_CLOSE = "accounts:close"
    ACCOUNTS_ALL = "accounts:*"

    # Transactions
    TRANSACTIONS_CREATE = "transactions:create"
    TRANSACTIONS_READ = "transactions:read"
    TRANSACTIONS_UPDATE = "transactions:update"
    TRANSACTIONS_APPROVE = "transactions:approve"
    TRANSACTIONS_REFUND = "transactions:refund"
    TRANSACTIONS_ALL = "transactions:*"

    # KYC
    KYC_READ = "kyc:read"
    KYC_UPLOAD = "kyc:upload"
    KYC_APPROVE = "kyc:approve"
    KYC_REJECT = "kyc:reject"
    KYC_ALL = "kyc:*"

    # Reports
    REPORTS_GENERATE = "reports:generate"
    REPORTS_EXPORT = "reports:export"
    REPORTS_ALL = "reports:*"

    # Audit
    AUDIT_READ = "audit:read"
    AUDIT_EXPORT = "audit:export"
    AUDIT_ALL = "audit:*"

    # Config
    CONFIG_READ = "config:read"
    CONFIG_WRITE = "config:write"
    CONFIG_ALL = "config:*"

    # Tickets (Support)
    TICKETS_CREATE = "tickets:create"
    TICKETS_READ = "tickets:read"
    TICKETS_UPDATE = "tickets:update"
    TICKETS_CLOSE = "tickets:close"
    TICKETS_ALL = "tickets:*"

    # Wildcard
    ALL = "*:*"


class RoleScope(str, Enum):
    """Scope d'application des permissions"""
    GLOBAL = "global"  # Accès à tous les tenants
    TENANT = "tenant"  # Accès limité au tenant de l'utilisateur


# Définition des rôles et leurs permissions
ROLES: Dict[str, Dict] = {
    "super_admin": {
        "permissions": [
            Permission.TENANTS_ALL,
            Permission.USERS_ALL,
            Permission.ACCOUNTS_ALL,
            Permission.TRANSACTIONS_ALL,
            Permission.KYC_ALL,
            Permission.REPORTS_ALL,
            Permission.AUDIT_READ,
            Permission.AUDIT_EXPORT,
            Permission.CONFIG_ALL,
            Permission.TICKETS_ALL
        ],
        "scope": RoleScope.GLOBAL,
        "description": "Administrateur global avec accès total"
    },

    "country_admin": {
        "permissions": [
            Permission.USERS_READ,
            Permission.USERS_UPDATE,
            Permission.USERS_ACTIVATE,
            Permission.USERS_DEACTIVATE,
            Permission.ACCOUNTS_READ,
            Permission.ACCOUNTS_UPDATE,
            Permission.TRANSACTIONS_READ,
            Permission.KYC_READ,
            Permission.KYC_APPROVE,
            Permission.KYC_REJECT,
            Permission.REPORTS_GENERATE,
            Permission.REPORTS_EXPORT,
            Permission.AUDIT_READ
        ],
        "scope": RoleScope.TENANT,
        "description": "Administrateur pays avec accès au tenant local"
    },

    "support_l1": {
        "permissions": [
            Permission.USERS_READ,
            Permission.ACCOUNTS_READ,
            Permission.TRANSACTIONS_READ,
            Permission.TICKETS_CREATE,
            Permission.TICKETS_READ,
            Permission.TICKETS_UPDATE
        ],
        "scope": RoleScope.TENANT,
        "description": "Agent support niveau 1"
    },

    "support_l2": {
        "permissions": [
            Permission.USERS_READ,
            Permission.ACCOUNTS_READ,
            Permission.ACCOUNTS_FREEZE,
            Permission.ACCOUNTS_UNFREEZE,
            Permission.TRANSACTIONS_READ,
            Permission.TRANSACTIONS_REFUND,
            Permission.TICKETS_CREATE,
            Permission.TICKETS_READ,
            Permission.TICKETS_UPDATE,
            Permission.TICKETS_CLOSE
        ],
        "scope": RoleScope.TENANT,
        "description": "Agent support niveau 2 avec permissions étendues"
    },

    "user": {
        "permissions": [
            Permission.ACCOUNTS_READ,
            Permission.TRANSACTIONS_CREATE,
            Permission.TRANSACTIONS_READ,
            Permission.KYC_UPLOAD
        ],
        "scope": RoleScope.TENANT,
        "description": "Utilisateur standard"
    }
}


def get_role_permissions(role: str) -> List[str]:
    """
    Récupère les permissions pour un rôle donné

    Args:
        role: Nom du rôle

    Returns:
        Liste des permissions

    Raises:
        ValueError: Si le rôle n'existe pas
    """
    if role not in ROLES:
        raise ValueError(f"Rôle inconnu: {role}")

    return [p.value if isinstance(p, Permission) else p for p in ROLES[role]["permissions"]]


def get_role_scope(role: str) -> RoleScope:
    """
    Récupère le scope d'un rôle

    Args:
        role: Nom du rôle

    Returns:
        Scope du rôle
    """
    if role not in ROLES:
        raise ValueError(f"Rôle inconnu: {role}")

    return ROLES[role]["scope"]


def has_permission(user_permissions: List[str], required_permission: str) -> bool:
    """
    Vérifie si une liste de permissions contient une permission requise
    Support des wildcards (* pour toutes les actions d'une ressource)

    Args:
        user_permissions: Liste des permissions de l'utilisateur
        required_permission: Permission à vérifier (format "resource:action")

    Returns:
        True si la permission est accordée

    Examples:
        >>> has_permission(["users:*"], "users:read")
        True
        >>> has_permission(["users:read"], "users:update")
        False
        >>> has_permission(["*:*"], "anything:anything")
        True
    """
    # Vérification wildcard global
    if "*:*" in user_permissions:
        return True

    # Vérification permission exacte
    if required_permission in user_permissions:
        return True

    # Vérification wildcard par ressource
    resource, action = required_permission.split(":")
    wildcard_permission = f"{resource}:*"

    if wildcard_permission in user_permissions:
        return True

    return False


def check_permissions(user_permissions: List[str], required_permissions: List[str]) -> bool:
    """
    Vérifie si l'utilisateur a toutes les permissions requises

    Args:
        user_permissions: Permissions de l'utilisateur
        required_permissions: Permissions requises

    Returns:
        True si toutes les permissions sont accordées
    """
    return all(has_permission(user_permissions, perm) for perm in required_permissions)


def expand_wildcard_permissions(permissions: List[str]) -> List[str]:
    """
    Expanse les permissions avec wildcards en liste complète
    Utile pour affichage dans UI admin

    Args:
        permissions: Liste de permissions avec wildcards

    Returns:
        Liste expanded de permissions

    Examples:
        >>> expand_wildcard_permissions(["users:*"])
        ["users:create", "users:read", "users:update", "users:delete", ...]
    """
    expanded = set()

    for perm in permissions:
        if perm == "*:*":
            # Retourner toutes les permissions
            expanded.update([p.value for p in Permission])
        elif perm.endswith(":*"):
            # Expander pour la ressource
            resource = perm.split(":")[0]
            expanded.update([
                p.value for p in Permission
                if p.value.startswith(f"{resource}:")
            ])
        else:
            expanded.add(perm)

    return sorted(list(expanded))

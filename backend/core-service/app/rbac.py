"""
Système RBAC (Role-Based Access Control) avancé pour Djembé Bank
Gère les permissions granulaires et les scopes multi-tenant
"""
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional, Callable
from jose import JWTError, jwt
from app.config import JWT_SECRET, ALGORITHM
from app.permissions import (
    get_role_permissions,
    get_role_scope,
    has_permission,
    check_permissions,
    RoleScope,
    ROLES
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


class CurrentUser:
    """Représente l'utilisateur authentifié actuel"""
    def __init__(self, user_id: str, email: str, role: str, tenant_id: Optional[str] = None):
        self.user_id = user_id
        self.email = email
        self.role = role
        self.tenant_id = tenant_id
        self._permissions = None

    @property
    def permissions(self) -> List[str]:
        """Récupère les permissions de l'utilisateur basées sur son rôle"""
        if self._permissions is None:
            self._permissions = get_role_permissions(self.role)
        return self._permissions

    @property
    def scope(self) -> RoleScope:
        """Récupère le scope du rôle"""
        return get_role_scope(self.role)

    def has_permission(self, permission: str) -> bool:
        """Vérifie si l'utilisateur a une permission spécifique"""
        return has_permission(self.permissions, permission)

    def has_permissions(self, permissions: List[str]) -> bool:
        """Vérifie si l'utilisateur a toutes les permissions requises"""
        return check_permissions(self.permissions, permissions)

    def can_access_tenant(self, tenant_id: str) -> bool:
        """Vérifie si l'utilisateur peut accéder à un tenant spécifique"""
        if self.scope == RoleScope.GLOBAL:
            return True
        return self.tenant_id == tenant_id


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    request: Request = None
) -> CurrentUser:
    """
    Récupère l'utilisateur authentifié depuis le token JWT
    Dépendance FastAPI pour injection dans les routes

    Args:
        token: Token JWT
        request: Requête FastAPI (pour accès au tenant_code)

    Returns:
        CurrentUser instance

    Raises:
        HTTPException: Si le token est invalide ou expiré
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Décoder le token JWT
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: str = payload.get("user_id")
        role: str = payload.get("role", "user")
        tenant_id: str = payload.get("tenant_id")

        if email is None:
            raise credentials_exception

        # Créer l'objet CurrentUser
        current_user = CurrentUser(
            user_id=user_id,
            email=email,
            role=role,
            tenant_id=tenant_id
        )

        # Injecter dans request.state pour usage dans middleware
        if request:
            request.state.user = current_user

        return current_user

    except JWTError:
        raise credentials_exception


def require_permissions(required_permissions: List[str]) -> Callable:
    """
    Dépendance pour vérifier les permissions
    Usage: dependencies=[Depends(require_permissions(["users:read", "users:update"]))]

    Args:
        required_permissions: Liste des permissions requises

    Returns:
        Fonction de dépendance FastAPI
    """
    async def permission_checker(current_user: CurrentUser = Depends(get_current_user)):
        # Vérifier si l'utilisateur a toutes les permissions requises
        if not current_user.has_permissions(required_permissions):
            missing_perms = [
                perm for perm in required_permissions
                if not current_user.has_permission(perm)
            ]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permissions insuffisantes. Manquant: {', '.join(missing_perms)}"
            )
        return current_user

    return permission_checker


def require_role(allowed_roles: List[str]) -> Callable:
    """
    Dépendance pour vérifier les rôles (méthode simplifiée)
    Usage: dependencies=[Depends(require_role(["super_admin", "country_admin"]))]

    Args:
        allowed_roles: Liste des rôles autorisés

    Returns:
        Fonction de dépendance FastAPI
    """
    async def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rôle '{current_user.role}' non autorisé. Rôles requis: {', '.join(allowed_roles)}"
            )
        return current_user

    return role_checker


def require_tenant_access(tenant_id: Optional[str] = None) -> Callable:
    """
    Dépendance pour vérifier l'accès à un tenant spécifique
    Usage: dependencies=[Depends(require_tenant_access(tenant_id))]

    Args:
        tenant_id: ID du tenant (None = utiliser X-Tenant-Code header)

    Returns:
        Fonction de dépendance FastAPI
    """
    async def tenant_checker(
        request: Request,
        current_user: CurrentUser = Depends(get_current_user)
    ):
        # Récupérer le tenant_id depuis le header si non fourni
        target_tenant = tenant_id or request.headers.get("X-Tenant-Code")

        if not target_tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant non spécifié"
            )

        # Vérifier si l'utilisateur peut accéder à ce tenant
        if not current_user.can_access_tenant(target_tenant):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé au tenant '{target_tenant}'"
            )

        return current_user

    return tenant_checker


class RBACMiddleware:
    """
    Middleware de contrôle d'accès basé sur les permissions
    Compatible avec l'ancienne interface pour rétro-compatibilité
    """
    def __init__(self, allowed_roles: List[str] = None, required_permissions: List[str] = None):
        self.allowed_roles = allowed_roles or []
        self.required_permissions = required_permissions or []

    def __call__(self, request: Request):
        # Récupérer l'utilisateur depuis request.state (injecté par get_current_user)
        user = getattr(request.state, "user", None)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Non authentifié"
            )

        # Vérification par rôle (legacy)
        if self.allowed_roles:
            if "*" not in self.allowed_roles and user.role not in self.allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Rôle '{user.role}' non autorisé"
                )

        # Vérification par permissions (nouveau système)
        if self.required_permissions:
            if not user.has_permissions(self.required_permissions):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permissions insuffisantes"
                )

        return user


# Dépendances prédéfinies pour usage commun
RequireSuperAdmin = Depends(require_role(["super_admin"]))
RequireCountryAdmin = Depends(require_role(["super_admin", "country_admin"]))
RequireSupport = Depends(require_role(["super_admin", "country_admin", "support_l1", "support_l2"]))
RequireSupportL2 = Depends(require_role(["super_admin", "country_admin", "support_l2"]))
RequireAdmin = Depends(require_role(["super_admin", "country_admin"]))

# Permissions prédéfinies
RequireUserManagement = Depends(require_permissions(["users:read", "users:update"]))
RequireKYCApproval = Depends(require_permissions(["kyc:approve", "kyc:reject"]))
RequireAccountFreeze = Depends(require_permissions(["accounts:freeze", "accounts:unfreeze"]))
RequireTransactionRefund = Depends(require_permissions(["transactions:refund"]))

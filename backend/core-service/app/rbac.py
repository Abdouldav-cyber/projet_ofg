from fastapi import Request, HTTPException, status
from typing import List, Callable

class RBACMiddleware:
    """Middleware de contrôle d'accès basé sur les rôles (Role-Based Access Control)."""
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, request: Request):
        # On suppose que le rôle utilisateur est injecté après la vérification JWT
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Non authentifié"
            )
        
        if "*" in self.allowed_roles:
            return
            
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rôle '{user.role}' non autorisé pour cette ressource"
            )

# Exemple d'usage dans les routes :
# @router.get("/admin/stats", dependencies=[Depends(RBACMiddleware(["super_admin"]))])

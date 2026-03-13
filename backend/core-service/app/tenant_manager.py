from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from app.database import SessionLocal, set_tenant_schema

class TenantMiddleware(BaseHTTPMiddleware):
    """Middleware extrayant l'identifiant du pays (Tenant) depuis les en-têtes HTTP."""
    async def dispatch(self, request: Request, call_next):
        # Extraction du pays depuis le header (ex: X-Tenant-Code: SN)
        tenant_code = request.headers.get("X-Tenant-Code")
        
        # Injection du code pays dans l'état de la requête pour usage ultérieur
        request.state.tenant_code = tenant_code
        
        response = await call_next(request)
        return response

def get_db_with_tenant(request: Request):
    """Dépendance FastAPI fournissant une session DB configurée sur le bon schéma pays."""
    db = SessionLocal()
    tenant_code = getattr(request.state, "tenant_code", None)
    
    if tenant_code:
        set_tenant_schema(db, tenant_code)
    
    try:
        yield db
    finally:
        db.close()

from fastapi import FastAPI
from app.routes import router
from app.tenant_manager import TenantMiddleware
from app.database import Base, engine
import app.models
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Creation des tables au demarrage
    Base.metadata.create_all(bind=engine)
    yield
    # Nettoyage si besoin a l'arret

tags_metadata = [
    {"name": "Authentification", "description": "Gestion des accès utilisateurs et tokens JWT."},
    {"name": "Services Bancaires", "description": "Gestion des comptes, soldes et virements sécurisés."},
    {"name": "Tontine", "description": "Innovation Djembé Bank pour l'épargne collective."},
    {"name": "Tenants & Pays", "description": "Configuration multi-pays de la plateforme."},
    {"name": "Conformite (KYC)", "description": "Verification d'identite et conformite reglementaire."},
]

from fastapi.responses import HTMLResponse
from fastapi.openapi.docs import get_swagger_ui_html

app = FastAPI(
    title="DJEMBE BANK - CORE API", 
    description="""
### **Plateforme Bancaire Multi-Tenant & Cloud-Native**

Bienvenue dans l'interface de gestion de l'API Djembé Bank. Ce portail vous permet de tester l'ensemble des fonctionnalités du système core.

---
**🚀 FONCTIONNALITÉS CLÉS :**
*   **Multi-tenant** : Isolation complète par pays (*headers X-Tenant-Code*).
*   **Sécurité** : Protection par JWT, RBAC et détection de fraude.
*   **Innovation** : Gestion numérique des Tontines.
""",
    version="1.0.0",
    docs_url=None, 
    redoc_url=None,
    lifespan=lifespan,
    openapi_tags=tags_metadata,
)

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    response = get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Documentation",
        swagger_ui_parameters={"defaultModelsExpandDepth": -1}
    )
    # Hack Premium : Injection de style pour masquer les badges et la topbar
    custom_style = """
    <style>
        .version, .openapi-version, .link, .topbar { display: none !important; }
        .info { margin: 20px 0 !important; border-left: 5px solid #2c3e50; padding-left: 20px; }
        .info .title { font-size: 32px !important; color: #1a202c !important; font-weight: 800; }
        .swagger-ui .info li, .swagger-ui .info p, .swagger-ui .info table { font-size: 15px; color: #4a5568; }
    </style>
    """
    new_content = response.body.decode().replace("</head>", f"{custom_style}</head>")
    return HTMLResponse(content=new_content, status_code=response.status_code)

# Enregistrement des middlewares
app.add_middleware(TenantMiddleware)

app.include_router(router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to Djembe Bank Core API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

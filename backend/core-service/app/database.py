from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import Optional
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def set_tenant_schema(db, tenant_code: str):
    """
    Bascule la connexion de la base de donnees vers un schema specifique d'un pays (tenant).
    """
    schema_name = f"tenant_{tenant_code.lower()}"
    # Vérifie si le schéma existe avant de basculer
    result = db.execute(text(f"SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema"), {"schema": schema_name})
    if result.fetchone():
        db.execute(text(f"SET search_path TO {schema_name}, public"))
    else:
        # Repli sur le schéma public si le schéma spécifique n'existe pas
        db.execute(text("SET search_path TO public"))

def get_db_with_tenant_code(request: Request):
    """
    Générateur de session DB pour le LOGIN (avant d'avoir un token)
    Utilise le header X-Tenant-Code au lieu du token JWT

    Args:
        request: Requête HTTP FastAPI

    Yields:
        Session DB configurée avec le bon schéma tenant

    Raises:
        HTTPException: Si le header X-Tenant-Code est manquant
    """
    db = SessionLocal()
    try:
        tenant_code = request.headers.get("X-Tenant-Code")

        if not tenant_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Header X-Tenant-Code manquant"
            )

        # Basculer vers le schéma tenant
        set_tenant_schema(db, tenant_code)

        yield db

    finally:
        db.close()

def get_db_with_tenant(
    token: str = Depends(oauth2_scheme),
    request: Request = None
):
    """
    Générateur de session DB avec schéma tenant automatiquement configuré
    Extrait le tenant_id depuis le JWT token et bascule vers le bon schéma

    Args:
        token: Token JWT OAuth2
        request: Requête HTTP FastAPI (optionnel)

    Yields:
        Session DB configurée avec le bon schéma tenant

    Raises:
        HTTPException: Si le token est invalide ou le tenant n'est pas trouvé
    """
    db = SessionLocal()
    try:
        # Décoder le token pour récupérer le tenant_id
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        tenant_id: Optional[str] = payload.get("tenant_id")

        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant ID manquant dans le token JWT"
            )

        # Basculer vers le schéma tenant
        set_tenant_schema(db, tenant_id)

        yield db

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token JWT invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )
    finally:
        db.close()

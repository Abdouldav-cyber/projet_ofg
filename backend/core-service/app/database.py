from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

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

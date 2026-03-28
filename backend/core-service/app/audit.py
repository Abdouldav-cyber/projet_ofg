from sqlalchemy import Column, String, TIMESTAMP, JSON, text
from sqlalchemy.dialects.postgresql import UUID, INET
from app.database import Base

class AuditLog(Base):
    """Journal d'audit centralisé (Spécification 4.4)."""
    __tablename__ = "audit_logs"

    log_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    timestamp = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    
    # Qui ?
    user_id = Column(UUID(as_uuid=True))
    user_email = Column(String(255))
    user_role = Column(String(50))
    ip_address = Column(INET)
    user_agent = Column(String)
    
    # Quoi ?
    action = Column(String(100))
    resource_type = Column(String(50))
    resource_id = Column(UUID(as_uuid=True))
    
    # Détails
    changes = Column(JSON)
    metadata_col = Column("metadata", JSON)
    
    # Contexte
    tenant_id = Column(UUID(as_uuid=True))
    request_id = Column(UUID(as_uuid=True))
    session_id = Column(UUID(as_uuid=True))

    @classmethod
    def log(cls, db, user_id, action, **kwargs):
        """Crée et persiste un log d'audit."""
        entry = cls(user_id=user_id, action=action, **kwargs)
        db.add(entry)
        db.commit()
        return entry

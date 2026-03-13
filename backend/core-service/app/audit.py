from sqlalchemy import Column, String, TIMESTAMP, JSON, text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class AuditLog(Base):
    """Journal d'audit immuable pour tracer chaque action sensible sur la plateforme."""
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), index=True)
    action = Column(String(100), nullable=False) # Ex: LOGIN, TRANSFER, UPDATE_KYC
    resource = Column(String(100)) # Ex: accounts, users
    resource_id = Column(String(100))
    details = Column(JSON) # Contient les anciennes et nouvelles valeurs
    ip_address = Column(String(45))
    user_agent = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

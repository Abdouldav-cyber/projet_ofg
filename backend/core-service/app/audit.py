from sqlalchemy import Column, String, TIMESTAMP, JSON, text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class AuditLog(Base):
    """Journal d'audit immuable pour tracer chaque action sensible sur la plateforme."""
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), index=True)
    tenant_id = Column(String(10))  # Code tenant pour isolation
    session_id = Column(String(100))  # ID de session pour traçabilité
    action = Column(String(100), nullable=False)  # Ex: LOGIN, TRANSFER, UPDATE_KYC
    resource = Column(String(100))  # Ex: accounts, users, transactions
    resource_id = Column(String(100))
    before_value = Column(JSON)  # Valeur avant modification
    after_value = Column(JSON)  # Valeur après modification
    details = Column(JSON)  # Informations complémentaires
    ip_address = Column(String(45))  # Adresse IP source
    user_agent = Column(String(255))  # User agent navigateur
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"), index=True)

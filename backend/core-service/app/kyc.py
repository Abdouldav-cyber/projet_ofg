from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class KYCDocument(Base):
    """Modèle stockant les métadonnées des documents d'identité (CNI, Passeport)."""
    __tablename__ = "kyc_documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    document_type = Column(String(50), nullable=False) # CNI, PASSPORT, PROOF_OF_RESIDENCE
    document_url = Column(String(255), nullable=False) # URL vers stockage S3 sécurisé
    status = Column(String(20), server_default="pending") # pending, verified, rejected
    rejection_reason = Column(String(255))
    submitted_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    verified_at = Column(TIMESTAMP)

class KYCService:
    """Service de gestion du processus de vérification d'identité."""
    
    @staticmethod
    def upload_document(user_id: str, doc_type: str, file_content: bytes):
        """Simule l'upload d'un document vers AWS S3 et enregistre les métadonnées."""
        # En production : utilisation de boto3 pour S3
        simulated_url = f"https://s3.aws.com/djembe-kyc/{user_id}/{doc_type}.pdf"
        return simulated_url

    @staticmethod
    def verify_document(db, document_id: str, approved: bool, reason: str = None):
        """Valide ou rejette un document KYC par un administrateur."""
        doc = db.query(KYCDocument).filter(KYCDocument.id == document_id).first()
        if doc:
            doc.status = "verified" if approved else "rejected"
            doc.rejection_reason = reason
            db.commit()
            return doc
        return None

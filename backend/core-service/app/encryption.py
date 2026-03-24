"""
Module de chiffrement AES-256-GCM pour données sensibles
Protège les PII (Personally Identifiable Information)
"""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
from typing import Optional, Any
import json


class EncryptionService:
    """Service de chiffrement/déchiffrement AES-256-GCM"""

    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialise le service de chiffrement

        Args:
            encryption_key: Clé de chiffrement (hex string de 64 caractères)
                          Si None, utilise la variable d'environnement ENCRYPTION_KEY
        """
        # Récupérer la clé depuis l'environnement ou paramètre
        key_hex = encryption_key or os.getenv("ENCRYPTION_KEY")

        if not key_hex:
            # En développement, générer une clé temporaire
            # En production, ceci devrait lever une exception
            import warnings
            warnings.warn(
                "ENCRYPTION_KEY non définie, génération d'une clé temporaire. "
                "NE PAS UTILISER EN PRODUCTION!",
                RuntimeWarning
            )
            self.key = AESGCM.generate_key(bit_length=256)
        else:
            try:
                # Convertir la clé hex en bytes
                self.key = bytes.fromhex(key_hex)
                if len(self.key) != 32:  # 256 bits = 32 bytes
                    raise ValueError("La clé doit faire 32 bytes (64 caractères hex)")
            except ValueError as e:
                raise ValueError(f"Clé de chiffrement invalide: {e}")

        self.aesgcm = AESGCM(self.key)

    def encrypt(self, plaintext: str) -> str:
        """
        Chiffre une chaîne de caractères

        Args:
            plaintext: Texte en clair

        Returns:
            Texte chiffré au format "iv:tag:ciphertext" (base64 encoded)

        Example:
            >>> service = EncryptionService()
            >>> encrypted = service.encrypt("123-45-6789")
            >>> print(encrypted)  # "iv_base64:tag_base64:ciphertext_base64"
        """
        if not plaintext:
            return ""

        # Générer un IV aléatoire de 12 bytes (recommandé pour GCM)
        iv = os.urandom(12)

        # Convertir le plaintext en bytes
        plaintext_bytes = plaintext.encode('utf-8')

        # Chiffrer (retourne ciphertext + tag de 16 bytes à la fin)
        ciphertext_and_tag = self.aesgcm.encrypt(iv, plaintext_bytes, None)

        # Séparer le ciphertext et le tag
        ciphertext = ciphertext_and_tag[:-16]
        tag = ciphertext_and_tag[-16:]

        # Encoder en base64 pour stockage
        iv_b64 = base64.b64encode(iv).decode('utf-8')
        tag_b64 = base64.b64encode(tag).decode('utf-8')
        ciphertext_b64 = base64.b64encode(ciphertext).decode('utf-8')

        # Format: "iv:tag:ciphertext"
        return f"{iv_b64}:{tag_b64}:{ciphertext_b64}"

    def decrypt(self, ciphertext: str) -> str:
        """
        Déchiffre une chaîne chiffrée

        Args:
            ciphertext: Texte chiffré au format "iv:tag:ciphertext"

        Returns:
            Texte en clair

        Raises:
            ValueError: Si le format est invalide
            Exception: Si le déchiffrement échoue (tag invalide)
        """
        if not ciphertext:
            return ""

        try:
            # Séparer les composants
            parts = ciphertext.split(":")
            if len(parts) != 3:
                raise ValueError("Format de chiffrement invalide")

            iv_b64, tag_b64, ciphertext_b64 = parts

            # Décoder depuis base64
            iv = base64.b64decode(iv_b64)
            tag = base64.b64decode(tag_b64)
            ciphertext_bytes = base64.b64decode(ciphertext_b64)

            # Reconstruire ciphertext + tag
            ciphertext_and_tag = ciphertext_bytes + tag

            # Déchiffrer
            plaintext_bytes = self.aesgcm.decrypt(iv, ciphertext_and_tag, None)

            return plaintext_bytes.decode('utf-8')

        except Exception as e:
            raise ValueError(f"Erreur de déchiffrement: {str(e)}")

    def encrypt_json(self, data: dict) -> str:
        """
        Chiffre un objet JSON

        Args:
            data: Dictionnaire Python

        Returns:
            JSON chiffré
        """
        json_string = json.dumps(data, ensure_ascii=False)
        return self.encrypt(json_string)

    def decrypt_json(self, encrypted: str) -> dict:
        """
        Déchiffre un objet JSON

        Args:
            encrypted: JSON chiffré

        Returns:
            Dictionnaire Python
        """
        json_string = self.decrypt(encrypted)
        return json.loads(json_string)

    @staticmethod
    def generate_key() -> str:
        """
        Génère une nouvelle clé de chiffrement aléatoire

        Returns:
            Clé en format hexadécimal (64 caractères)

        Example:
            >>> key = EncryptionService.generate_key()
            >>> print(len(key))  # 64
            >>> service = EncryptionService(encryption_key=key)
        """
        key_bytes = AESGCM.generate_key(bit_length=256)
        return key_bytes.hex()

    def rotate_key(self, old_service: 'EncryptionService', encrypted_value: str) -> str:
        """
        Réchiffre une valeur avec une nouvelle clé

        Args:
            old_service: Service avec l'ancienne clé
            encrypted_value: Valeur chiffrée avec l'ancienne clé

        Returns:
            Valeur réchiffrée avec la nouvelle clé

        Example:
            >>> old_service = EncryptionService(old_key)
            >>> new_service = EncryptionService(new_key)
            >>> encrypted_old = old_service.encrypt("secret")
            >>> encrypted_new = new_service.rotate_key(old_service, encrypted_old)
        """
        # Déchiffrer avec l'ancienne clé
        plaintext = old_service.decrypt(encrypted_value)

        # Rechiffrer avec la nouvelle clé
        return self.encrypt(plaintext)


# Instance globale du service (singleton pattern)
_encryption_service: Optional[EncryptionService] = None


def get_encryption_service() -> EncryptionService:
    """
    Récupère l'instance globale du service de chiffrement

    Returns:
        Instance de EncryptionService
    """
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service


# Fonctions utilitaires pour usage direct
def encrypt_field(plaintext: str) -> str:
    """Chiffre un champ (fonction utilitaire)"""
    return get_encryption_service().encrypt(plaintext)


def decrypt_field(ciphertext: str) -> str:
    """Déchiffre un champ (fonction utilitaire)"""
    return get_encryption_service().decrypt(ciphertext)


# Décorateur pour chiffrement automatique de propriétés
class EncryptedField:
    """
    Décorateur pour champs chiffrés automatiquement en base de données

    Usage:
        class User:
            def __init__(self):
                self._ssn = None

            @property
            def ssn(self):
                return decrypt_field(self._ssn) if self._ssn else None

            @ssn.setter
            def ssn(self, value):
                self._ssn = encrypt_field(value) if value else None
    """

    def __init__(self, storage_attr: str):
        self.storage_attr = storage_attr

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        encrypted = getattr(obj, self.storage_attr, None)
        if encrypted:
            return decrypt_field(encrypted)
        return None

    def __set__(self, obj, value):
        if value:
            encrypted = encrypt_field(value)
            setattr(obj, self.storage_attr, encrypted)
        else:
            setattr(obj, self.storage_attr, None)


# Mixin pour modèles SQLAlchemy avec champs chiffrés
class EncryptedModelMixin:
    """
    Mixin pour ajouter des méthodes de chiffrement aux modèles SQLAlchemy

    Usage:
        class User(Base, EncryptedModelMixin):
            __tablename__ = "users"
            encrypted_fields = ["ssn", "tax_id"]

            ssn = Column(String(255))
            tax_id = Column(String(255))

        # Lors de l'insertion
        user = User()
        user.set_encrypted("ssn", "123-45-6789")

        # Lors de la lecture
        ssn_value = user.get_decrypted("ssn")
    """

    encrypted_fields: list = []

    def set_encrypted(self, field: str, value: str):
        """Définit un champ chiffré"""
        if field not in self.encrypted_fields:
            raise ValueError(f"Le champ '{field}' n'est pas configuré pour le chiffrement")
        encrypted = encrypt_field(value) if value else None
        setattr(self, field, encrypted)

    def get_decrypted(self, field: str) -> Optional[str]:
        """Récupère un champ déchiffré"""
        if field not in self.encrypted_fields:
            raise ValueError(f"Le champ '{field}' n'est pas configuré pour le chiffrement")
        encrypted = getattr(self, field, None)
        if encrypted:
            return decrypt_field(encrypted)
        return None


# Script de rotation des clés (à utiliser en CLI)
def rotate_all_keys(db_session, old_key_hex: str, new_key_hex: str):
    """
    Rotation de toutes les clés de chiffrement dans la base de données

    Args:
        db_session: Session SQLAlchemy
        old_key_hex: Ancienne clé (hex)
        new_key_hex: Nouvelle clé (hex)

    Example:
        python -c "from app.encryption import rotate_all_keys, generate_key; ..."
    """
    from app.models import User
    from app.kyc import KYCDocument

    old_service = EncryptionService(encryption_key=old_key_hex)
    new_service = EncryptionService(encryption_key=new_key_hex)

    # Rotation pour les utilisateurs (si champs chiffrés existent)
    users = db_session.query(User).all()
    for user in users:
        # Example: si on avait un champ tax_id chiffré
        if hasattr(user, 'tax_id') and user.tax_id:
            user.tax_id = new_service.rotate_key(old_service, user.tax_id)

    # Rotation pour les documents KYC
    docs = db_session.query(KYCDocument).all()
    for doc in docs:
        # Si document_url ou autres champs sont chiffrés
        if hasattr(doc, 'encrypted_data') and doc.encrypted_data:
            doc.encrypted_data = new_service.rotate_key(old_service, doc.encrypted_data)

    db_session.commit()
    print(f"Rotation des clés terminée pour {len(users)} utilisateurs et {len(docs)} documents")

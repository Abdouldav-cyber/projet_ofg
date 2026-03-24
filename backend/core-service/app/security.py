import bcrypt
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Any, Union
from jose import jwt
from app.config import settings

def _prepare_password(password: str) -> bytes:
    """
    Prépare le mot de passe pour bcrypt.
    Utilise SHA256 si le mot de passe dépasse 72 bytes (limitation bcrypt).
    """
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # Utiliser SHA256 pour les mots de passe longs
        return hashlib.sha256(password_bytes).hexdigest().encode('utf-8')
    return password_bytes

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie si le mot de passe en clair correspond au hash stocké."""
    prepared_password = _prepare_password(plain_password)
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(prepared_password, hashed_bytes)

def get_password_hash(password: str) -> str:
    """
    Génère un hash sécurisé à partir d'un mot de passe.
    Support des mots de passe de toute longueur via SHA256+bcrypt.
    """
    prepared_password = _prepare_password(password)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(prepared_password, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Génère un token JWT signé pour l'authentification."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt

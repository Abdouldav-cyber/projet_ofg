import pyotp
import qrcode
from io import BytesIO
import base64
import random
import math

class MFAService:
    """Service gérant l'authentification multi-facteurs (2FA) (Spec 5.3)."""

    @staticmethod
    async def enableTOTP(userId: str) -> dict:
        """Génère un secret TOTP et un QR code."""
        # Générer secret
        secret = pyotp.random_base32()
        
        # URI pour authenticator
        uri = pyotp.totp.TOTP(secret).provisioning_uri(name=f"User-{userId}", issuer_name="Djembé Bank")
        
        # Générer QR code en base64
        img = qrcode.make(uri)
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        qrCode = f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode()}"
        
        # Retourne structure exacte attendue "secret" et "qrCode"
        return {
            "secret": secret,
            "qrCode": qrCode
        }

    @staticmethod
    async def verifyTOTP(userId: str, token: str, secret: str = None) -> bool:
        """Vérifie le code à 6 chiffres soumis par l'utilisateur."""
        if not secret:
            return False
            
        totp = pyotp.totp.TOTP(secret)
        # La spec demande d'accepter ±2 fenêtres de 30s
        verified = totp.verify(token, valid_window=2)
        
        return verified

    @staticmethod
    async def sendSMSCode(phoneNumber: str) -> str:
        """Simulation d'envoi SMS et cache Redis (Spec 5.3)."""
        code = str(math.floor(100000 + random.random() * 900000))
        
        # Simulation d'envoi via Twilio
        print(f"[TWILIO SIMULAR] Message envoyé au {phoneNumber} : Votre code Djembé Bank: {code}. Valide 5min.")
        
        return code

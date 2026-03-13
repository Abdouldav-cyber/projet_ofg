import pyotp
import qrcode
from io import BytesIO
import base64

class MFAService:
    """Service gérant l'authentification multi-facteurs (MFA/TOTP)."""
    @staticmethod
    def generate_totp_secret():
        """Génère une clé secrète aléatoire pour un utilisateur."""
        return pyotp.random_base32()

    @staticmethod
    def get_totp_uri(secret: str, email: str):
        """Génère l'URI de provisionnement pour Google Authenticator."""
        return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name="Djembé Bank")

    @staticmethod
    def verify_totp_code(secret: str, code: str):
        """Vérifie le code à 6 chiffres soumis par l'utilisateur."""
        totp = pyotp.totp.TOTP(secret)
        return totp.verify(code)

    @staticmethod
    def generate_qr_code_base64(uri: str):
        img = qrcode.make(uri)
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode()

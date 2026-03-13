import os
from twilio.rest import Client
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

class NotificationService:
    """Service gérant l'envoi de SMS (Twilio) et d'Emails (SendGrid)."""
    
    def __init__(self):
        # Configuration Twilio
        self.twilio_sid = os.getenv("TWILIO_ACCOUNT_SID", "AC_SIMULATED_SID")
        self.twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN", "SIMULATED_TOKEN")
        self.twilio_phone = os.getenv("TWILIO_PHONE_NUMBER", "+123456789")
        
        # Configuration SendGrid
        self.sendgrid_key = os.getenv("SENDGRID_API_KEY", "SG.SIMULATED_KEY")

    def send_sms(self, to_phone: str, message: str):
        """Envoie un SMS via l'API Twilio."""
        try:
            client = Client(self.twilio_sid, self.twilio_auth_token)
            client.messages.create(
                body=message,
                from_=self.twilio_phone,
                to=to_phone
            )
            print(f"SMS envoyé à {to_phone}")
            return True
        except Exception as e:
            print(f"Erreur envoi SMS : {e}")
            return False

    def send_email(self, to_email: str, subject: str, content: str):
        """Envoie un email via l'API SendGrid."""
        message = Mail(
            from_email='noreply@djembé-bank.com',
            to_emails=to_email,
            subject=subject,
            plain_text_content=content
        )
        try:
            sg = SendGridAPIClient(self.sendgrid_key)
            sg.send(message)
            print(f"Email envoyé à {to_email}")
            return True
        except Exception as e:
            print(f"Erreur envoi Email : {e}")
            return False

    def send_otp(self, to_phone: str, otp_code: str):
        """Service spécialisé pour l'envoi des codes de vérification (OTP)."""
        msg = f"Votre code de vérification Djembé Bank est : {otp_code}. Ne le partagez jamais."
        return self.send_sms(to_phone, msg)

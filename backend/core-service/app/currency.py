from decimal import Decimal
from datetime import datetime
import redis
import json
from app.config import settings

class CurrencyService:
    """Service de gestion des taux de change avec mise en cache Redis."""
    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL)
        # Taux de change fixes (doivent être remplacés par un appel API externe en production)
        self.fixed_rates = {
            "EUR_XOF": Decimal("655.957"),
            "XOF_EUR": Decimal("0.0015"),
            "USD_XOF": Decimal("600.00"),
            "XOF_USD": Decimal("0.0016"),
        }

    def get_rate(self, from_currency: str, to_currency: str) -> Decimal:
        """Récupère le taux de change avec vérification du cache Redis."""
        if from_currency == to_currency:
            return Decimal("1.0")
        
        cache_key = f"rate:{from_currency}:{to_currency}"
        cached_rate = self.redis.get(cache_key)
        
        if cached_rate:
            return Decimal(cached_rate.decode('utf-8'))
        
        # Repli sur les taux fixes (ou appel API)
        pair = f"{from_currency}_{to_currency}"
        rate = self.fixed_rates.get(pair, Decimal("1.0"))
        
        # Mise en cache pour 5 minutes (TTL 300s)
        self.redis.setex(cache_key, 300, str(rate))
        return rate

    def convert(self, amount: Decimal, from_currency: str, to_currency: str) -> Decimal:
        rate = self.get_rate(from_currency, to_currency)
        return amount * rate

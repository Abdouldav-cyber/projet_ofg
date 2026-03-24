"""
Service de conversion de devises avec API externe
Utilise ExchangeRate-API avec fallback sur taux fixes
"""
from decimal import Decimal
from datetime import datetime
import redis
import json
import requests
import os
from typing import Optional, Dict


class CurrencyService:
    """
    Service de gestion des taux de change
    - Cache Redis (TTL 5 minutes)
    - API externe: https://api.exchangerate-api.com
    - Fallback sur taux fixes si API down
    """

    # Taux de change fixes (fallback)
    FIXED_RATES = {
        "EUR_XOF": Decimal("655.957"),
        "XOF_EUR": Decimal("0.001524"),
        "USD_XOF": Decimal("600.00"),
        "XOF_USD": Decimal("0.001667"),
        "GBP_XOF": Decimal("790.00"),
        "XOF_GBP": Decimal("0.001266"),
        "NGN_XOF": Decimal("1.45"),
        "XOF_NGN": Decimal("0.689"),
        "GHS_XOF": Decimal("52.00"),
        "XOF_GHS": Decimal("0.019"),
    }

    # Devises supportées
    SUPPORTED_CURRENCIES = ["XOF", "EUR", "USD", "GBP", "NGN", "GHS"]

    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis = redis.from_url(redis_url, decode_responses=True)

        # API Key pour ExchangeRate-API (optionnelle, gratuit sans clé)
        self.api_key = os.getenv("EXCHANGE_RATE_API_KEY")
        self.api_base_url = "https://api.exchangerate-api.com/v4/latest"

        # Alternative gratuite: https://api.exchangerate.host/latest
        self.fallback_api_url = "https://api.exchangerate.host/latest"

    def get_rate_from_api(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        """
        Récupère le taux depuis une API externe

        Args:
            from_currency: Devise source
            to_currency: Devise cible

        Returns:
            Taux de change ou None si erreur
        """
        try:
            # Méthode 1: ExchangeRate-API
            url = f"{self.api_base_url}/{from_currency}"
            response = requests.get(url, timeout=3)

            if response.status_code == 200:
                data = response.json()
                rates = data.get("rates", {})

                if to_currency in rates:
                    rate = Decimal(str(rates[to_currency]))
                    print(f"✅ Taux récupéré depuis API: 1 {from_currency} = {rate} {to_currency}")
                    return rate

            # Méthode 2: Fallback sur exchangerate.host
            url = f"{self.fallback_api_url}?base={from_currency}&symbols={to_currency}"
            response = requests.get(url, timeout=3)

            if response.status_code == 200:
                data = response.json()
                rates = data.get("rates", {})

                if to_currency in rates:
                    rate = Decimal(str(rates[to_currency]))
                    print(f"✅ Taux récupéré depuis API fallback: 1 {from_currency} = {rate} {to_currency}")
                    return rate

        except Exception as e:
            print(f"⚠️ Erreur API taux de change: {e}")

        return None

    def get_rate(self, from_currency: str, to_currency: str) -> Decimal:
        """
        Récupère le taux de change avec stratégie multi-niveaux:
        1. Cache Redis
        2. API externe
        3. Taux fixes (fallback)

        Args:
            from_currency: Devise source
            to_currency: Devise cible

        Returns:
            Taux de change
        """
        # Cas trivial: même devise
        if from_currency == to_currency:
            return Decimal("1.0")

        # Vérifier cache Redis
        cache_key = f"rate:{from_currency}:{to_currency}"
        cached_rate = self.redis.get(cache_key)

        if cached_rate:
            print(f"🔄 Taux depuis cache: 1 {from_currency} = {cached_rate} {to_currency}")
            return Decimal(cached_rate)

        # Essayer API externe
        api_rate = self.get_rate_from_api(from_currency, to_currency)

        if api_rate:
            # Mettre en cache (TTL 5 minutes)
            self.redis.setex(cache_key, 300, str(api_rate))
            return api_rate

        # Fallback sur taux fixes
        pair = f"{from_currency}_{to_currency}"
        fixed_rate = self.FIXED_RATES.get(pair)

        if fixed_rate:
            print(f"⚡ Taux fixe utilisé: 1 {from_currency} = {fixed_rate} {to_currency}")
            # Mettre en cache (TTL 1 minute seulement)
            self.redis.setex(cache_key, 60, str(fixed_rate))
            return fixed_rate

        # Dernier recours: calculer l'inverse si disponible
        reverse_pair = f"{to_currency}_{from_currency}"
        reverse_rate = self.FIXED_RATES.get(reverse_pair)

        if reverse_rate:
            calculated_rate = Decimal("1") / reverse_rate
            print(f"🔁 Taux calculé (inverse): 1 {from_currency} = {calculated_rate} {to_currency}")
            self.redis.setex(cache_key, 60, str(calculated_rate))
            return calculated_rate

        # Si vraiment aucun taux trouvé, lever une exception
        raise ValueError(f"Impossible de trouver le taux de change pour {from_currency} → {to_currency}")

    def convert(self, amount: Decimal, from_currency: str, to_currency: str) -> Decimal:
        """
        Convertit un montant d'une devise à une autre

        Args:
            amount: Montant à convertir
            from_currency: Devise source
            to_currency: Devise cible

        Returns:
            Montant converti

        Example:
            >>> service = CurrencyService()
            >>> result = service.convert(Decimal("100"), "EUR", "XOF")
            >>> print(result)  # ~65595.70 XOF
        """
        rate = self.get_rate(from_currency, to_currency)
        converted = amount * rate
        return converted.quantize(Decimal("0.01"))  # 2 décimales

    def get_all_rates(self, base_currency: str) -> Dict[str, Decimal]:
        """
        Récupère tous les taux pour une devise de base

        Args:
            base_currency: Devise de référence

        Returns:
            Dict {devise: taux}
        """
        rates = {}

        for currency in self.SUPPORTED_CURRENCIES:
            if currency != base_currency:
                try:
                    rates[currency] = self.get_rate(base_currency, currency)
                except:
                    pass

        return rates

    def log_conversion(
        self,
        amount: Decimal,
        from_currency: str,
        to_currency: str,
        rate: Decimal,
        result: Decimal,
        user_id: Optional[str] = None
    ):
        """
        Logue une conversion pour conformité

        Args:
            amount: Montant source
            from_currency: Devise source
            to_currency: Devise cible
            rate: Taux utilisé
            result: Montant converti
            user_id: ID utilisateur (optionnel)
        """
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "amount": str(amount),
            "from_currency": from_currency,
            "to_currency": to_currency,
            "rate": str(rate),
            "result": str(result),
            "user_id": user_id
        }

        # Stocker dans Redis list (keep last 1000)
        log_key = "currency:conversion_logs"
        self.redis.lpush(log_key, json.dumps(log_entry))
        self.redis.ltrim(log_key, 0, 999)

    def clear_cache(self):
        """Vide le cache des taux de change"""
        pattern = "rate:*"
        keys = self.redis.keys(pattern)

        if keys:
            self.redis.delete(*keys)
            print(f"🗑️ {len(keys)} taux de change supprimés du cache")


# Instance singleton
_currency_service: Optional[CurrencyService] = None


def get_currency_service() -> CurrencyService:
    """Récupère l'instance globale du service"""
    global _currency_service
    if _currency_service is None:
        _currency_service = CurrencyService()
    return _currency_service

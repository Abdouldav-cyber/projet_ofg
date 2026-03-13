from decimal import Decimal
from typing import Dict

class FraudEngine:
    """Moteur de détection de fraude basé sur des règles heuristiques et du scoring."""
    
    # Seuils de vigilance
    HIGH_AMOUNT_THRESHOLD = Decimal("5000000") # 5 Millions XOF
    MAX_DAILY_TRANSFERS = 10

    @staticmethod
    def score_transaction(amount: Decimal, user_history: Dict) -> float:
        """
        Calcule un score de risque pour une transaction donnée.
        0.0 = Sûr, 1.0 = Fraude certaine.
        """
        score = 0.0
        
        # Règle 1 : Montant atypique
        if amount > FraudEngine.HIGH_AMOUNT_THRESHOLD:
            score += 0.4
            
        # Règle 2 : Fréquence suspecte
        if user_history.get("daily_count", 0) > FraudEngine.MAX_DAILY_TRANSFERS:
            score += 0.5
            
        # Règle 3 : Localisation inhabituelle (Simulé)
        if user_history.get("new_location", False):
            score += 0.3
            
        return min(score, 1.0)

    @staticmethod
    def is_blocked(score: float) -> bool:
        """Détermine si la transaction doit être bloquée immédiatement (> 0.8)."""
        return score >= 0.8

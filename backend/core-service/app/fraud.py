"""
Moteur de détection de fraude avancé avec feature engineering
Combine règles heuristiques et scoring ML basique
"""
from decimal import Decimal
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.models import Transaction, Account, User
import math


class FraudEngine:
    """
    Moteur de détection de fraude multi-niveaux
    Scoring: 0 (sûr) à 100 (fraude certaine)
    """

    # Seuils de risque
    LOW_RISK_THRESHOLD = 30
    MEDIUM_RISK_THRESHOLD = 70
    HIGH_RISK_THRESHOLD = 85

    # Montants limites
    HIGH_AMOUNT_THRESHOLD = Decimal("5000000")  # 5M XOF
    VERY_HIGH_AMOUNT_THRESHOLD = Decimal("10000000")  # 10M XOF

    # Fréquences suspectes
    MAX_DAILY_TRANSFERS = 10
    MAX_HOURLY_TRANSFERS = 5

    @staticmethod
    def extract_features(
        db: Session,
        user_id: str,
        account_id: str,
        amount: Decimal,
        currency: str,
        transaction_type: str,
        recipient_id: Optional[str] = None
    ) -> Dict:
        """
        Feature engineering pour analyse de fraude

        Features extraites:
        - amount_normalized: Montant normalisé
        - hour_of_day: Heure de la transaction (0-23)
        - day_of_week: Jour de la semaine (0-6)
        - user_velocity_24h: Nombre de transactions 24h
        - user_velocity_1h: Nombre de transactions 1h
        - avg_transaction_amount: Montant moyen des transactions utilisateur
        - amount_deviation: Écart du montant par rapport à la moyenne
        - is_new_recipient: Flag si nouveau destinataire
        - account_age_days: Âge du compte en jours
        - recipient_exists: Flag si le destinataire existe
        - is_round_number: Flag si montant rond (suspect)
        - is_business_hours: Flag si heures ouvrables
        """
        now = datetime.utcnow()

        # Temporal features
        hour_of_day = now.hour
        day_of_week = now.weekday()
        is_business_hours = 8 <= hour_of_day <= 18 and day_of_week < 5

        # User velocity (fréquence)
        last_24h = now - timedelta(hours=24)
        last_1h = now - timedelta(hours=1)

        velocity_24h = db.query(func.count(Transaction.id)).filter(
            Transaction.from_account_id == account_id,
            Transaction.created_at >= last_24h,
            Transaction.status.in_(["completed", "pending"])
        ).scalar() or 0

        velocity_1h = db.query(func.count(Transaction.id)).filter(
            Transaction.from_account_id == account_id,
            Transaction.created_at >= last_1h,
            Transaction.status.in_(["completed", "pending"])
        ).scalar() or 0

        # Statistical features
        avg_amount = db.query(
            func.avg(text("CAST(amount AS NUMERIC)"))
        ).filter(
            Transaction.from_account_id == account_id,
            Transaction.status == "completed"
        ).scalar() or 0

        avg_amount = Decimal(avg_amount) if avg_amount else Decimal(0)

        # Déviation du montant
        if avg_amount > 0:
            amount_deviation = abs(float(amount - avg_amount) / float(avg_amount))
        else:
            amount_deviation = 1.0  # Première transaction = suspect

        # Nouveau destinataire
        is_new_recipient = True
        if recipient_id:
            previous_tx = db.query(Transaction).filter(
                Transaction.from_account_id == account_id,
                Transaction.to_account_id == recipient_id,
                Transaction.status == "completed"
            ).first()
            is_new_recipient = previous_tx is None

        # Âge du compte
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.created_at:
            account_age_days = (now - user.created_at).days
        else:
            account_age_days = 0

        # Montant rond (suspect)
        is_round_number = amount % 1000 == 0

        # Récipient existe
        recipient_exists = False
        if recipient_id:
            recipient_account = db.query(Account).filter(Account.id == recipient_id).first()
            recipient_exists = recipient_account is not None

        return {
            "amount": float(amount),
            "amount_normalized": float(amount) / 1000000,  # En millions
            "hour_of_day": hour_of_day,
            "day_of_week": day_of_week,
            "is_business_hours": is_business_hours,
            "user_velocity_24h": velocity_24h,
            "user_velocity_1h": velocity_1h,
            "avg_transaction_amount": float(avg_amount),
            "amount_deviation": amount_deviation,
            "is_new_recipient": is_new_recipient,
            "account_age_days": account_age_days,
            "recipient_exists": recipient_exists,
            "is_round_number": is_round_number,
            "transaction_type": transaction_type
        }

    @staticmethod
    def apply_heuristic_rules(features: Dict) -> float:
        """
        Applique des règles heuristiques métier
        Retourne un score de 0 à 100
        """
        score = 0.0

        # Règle 1: Montant élevé
        if features["amount"] > float(FraudEngine.VERY_HIGH_AMOUNT_THRESHOLD):
            score += 25
        elif features["amount"] > float(FraudEngine.HIGH_AMOUNT_THRESHOLD):
            score += 15

        # Règle 2: Vélocité suspecte
        if features["user_velocity_1h"] > FraudEngine.MAX_HOURLY_TRANSFERS:
            score += 30
        elif features["user_velocity_24h"] > FraudEngine.MAX_DAILY_TRANSFERS:
            score += 20

        # Règle 3: Nouveau compte (< 7 jours)
        if features["account_age_days"] < 7:
            score += 15

        # Règle 4: Déviation importante du montant habituel
        if features["amount_deviation"] > 3:  # 300% du montant moyen
            score += 20
        elif features["amount_deviation"] > 1:  # 100% du montant moyen
            score += 10

        # Règle 5: Nouveau destinataire + montant élevé
        if features["is_new_recipient"] and features["amount"] > 1000000:
            score += 15

        # Règle 6: Transaction hors heures ouvrables + montant élevé
        if not features["is_business_hours"] and features["amount"] > 2000000:
            score += 10

        # Règle 7: Montant rond très élevé (suspect de blanchiment)
        if features["is_round_number"] and features["amount"] > 5000000:
            score += 10

        # Règle 8: Destinataire inexistant (erreur ou fraude)
        if not features["recipient_exists"] and features["transaction_type"] == "internal":
            score += 50  # Très suspect

        return min(score, 100)

    @staticmethod
    def score_transaction(
        db: Session,
        user_id: str,
        account_id: str,
        amount: Decimal,
        currency: str,
        transaction_type: str = "internal",
        recipient_id: Optional[str] = None
    ) -> Dict:
        """
        Score une transaction pour risque de fraude

        Returns:
            Dict avec:
            - score: Score de risque (0-100)
            - risk_level: LOW, MEDIUM, HIGH
            - features: Features extraites
            - flags: Liste des drapeaux levés
        """
        # Extraire features
        features = FraudEngine.extract_features(
            db=db,
            user_id=user_id,
            account_id=account_id,
            amount=amount,
            currency=currency,
            transaction_type=transaction_type,
            recipient_id=recipient_id
        )

        # Calculer score heuristique
        score = FraudEngine.apply_heuristic_rules(features)

        # Classifier le risque
        if score < FraudEngine.LOW_RISK_THRESHOLD:
            risk_level = "LOW"
        elif score < FraudEngine.MEDIUM_RISK_THRESHOLD:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        # Générer flags explicatifs
        flags = []
        if features["amount"] > float(FraudEngine.HIGH_AMOUNT_THRESHOLD):
            flags.append("MONTANT_ELEVE")
        if features["user_velocity_24h"] > FraudEngine.MAX_DAILY_TRANSFERS:
            flags.append("FREQUENCE_SUSPECTE")
        if features["account_age_days"] < 7:
            flags.append("COMPTE_RECENT")
        if features["is_new_recipient"]:
            flags.append("NOUVEAU_DESTINATAIRE")
        if features["amount_deviation"] > 2:
            flags.append("DEVIATION_MONTANT")
        if not features["is_business_hours"]:
            flags.append("HORS_HEURES_OUVRABLES")
        if not features["recipient_exists"]:
            flags.append("DESTINATAIRE_INEXISTANT")

        return {
            "score": round(score, 2),
            "risk_level": risk_level,
            "features": features,
            "flags": flags,
            "should_block": risk_level == "HIGH" and score >= FraudEngine.HIGH_RISK_THRESHOLD,
            "should_review": risk_level == "MEDIUM"
        }

    @staticmethod
    def is_blocked(score_result: Dict) -> bool:
        """
        Détermine si la transaction doit être bloquée

        Args:
            score_result: Résultat du scoring

        Returns:
            True si la transaction doit être bloquée
        """
        return score_result.get("should_block", False)

    @staticmethod
    def get_fraud_explanation(score_result: Dict) -> str:
        """
        Génère une explication lisible du score de fraude

        Args:
            score_result: Résultat du scoring

        Returns:
            Explication textuelle
        """
        risk_level = score_result["risk_level"]
        score = score_result["score"]
        flags = score_result["flags"]

        if risk_level == "LOW":
            return f"Transaction à faible risque (Score: {score}/100)"

        explanation = f"Transaction à risque {risk_level} (Score: {score}/100). "

        if flags:
            explanation += "Alertes: " + ", ".join(flags)

        return explanation

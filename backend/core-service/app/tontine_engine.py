"""
Moteur de gestion des Tontines - Innovation Djembé Bank
Gère les cycles de contributions et la distribution automatique
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Tontine, TontineMember, TontineCycle, Transaction, Account, AccountBalance
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
import random


class TontineEngine:
    """Moteur de gestion des tontines"""

    @staticmethod
    def create_tontine(
        db: Session,
        name: str,
        admin_id: str,
        target_amount: Decimal,
        frequency: str,
        distribution_method: str = "rotating"
    ) -> Tontine:
        """
        Crée une nouvelle tontine

        Args:
            db: Session base de données
            name: Nom de la tontine
            admin_id: ID de l'administrateur/créateur
            target_amount: Montant cible par cycle
            frequency: Fréquence (weekly, monthly)
            distribution_method: Méthode de distribution (rotating, random, vote)

        Returns:
            Tontine créée
        """
        tontine = Tontine(
            name=name,
            admin_id=admin_id,
            target_amount=str(target_amount),
            frequency=frequency,
            status="open"  # open, active, completed
        )
        db.add(tontine)
        db.commit()
        db.refresh(tontine)

        return tontine

    @staticmethod
    def add_member(
        db: Session,
        tontine_id: str,
        user_id: str,
        contribution_amount: Decimal
    ) -> TontineMember:
        """
        Ajoute un membre à une tontine

        Args:
            db: Session base de données
            tontine_id: ID de la tontine
            user_id: ID de l'utilisateur
            contribution_amount: Montant de contribution

        Returns:
            Membre ajouté
        """
        tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
        if not tontine:
            raise ValueError("Tontine non trouvée")

        if tontine.status not in ("open", "active"):
            raise ValueError("La tontine n'accepte plus de nouveaux membres")

        # Vérifier si l'utilisateur n'est pas déjà membre
        existing = db.query(TontineMember).filter(
            TontineMember.tontine_id == tontine_id,
            TontineMember.user_id == user_id
        ).first()

        if existing:
            raise ValueError("Utilisateur déjà membre de cette tontine")

        # Calculer le prochain ordre (position dans le cycle)
        max_order = db.query(func.max(TontineMember.order)).filter(
            TontineMember.tontine_id == tontine_id
        ).scalar() or 0

        member = TontineMember(
            tontine_id=tontine_id,
            user_id=user_id,
            contribution_amount=str(contribution_amount),
            order=str(max_order + 1)
        )
        db.add(member)
        db.flush()
        result = {
            "id": str(member.id),
            "tontine_id": str(member.tontine_id),
            "user_id": str(member.user_id),
            "contribution_amount": float(contribution_amount),
            "order": max_order + 1,
            "joined_at": member.joined_at.isoformat() if member.joined_at else None
        }
        db.commit()

        return result

    @staticmethod
    def start_tontine(db: Session, tontine_id: str, admin_id: str):
        """
        Démarre une tontine (plus de nouveaux membres possibles)

        Args:
            db: Session base de données
            tontine_id: ID de la tontine
            admin_id: ID de l'admin (pour vérification)
        """
        tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
        if not tontine:
            raise ValueError("Tontine non trouvée")

        if tontine.status == "active":
            raise ValueError("La tontine est deja active")

        # Vérifier qu'il y a au moins 2 membres
        members_count = db.query(func.count(TontineMember.id)).filter(
            TontineMember.tontine_id == tontine_id
        ).scalar()

        if members_count < 2:
            raise ValueError(f"Une tontine doit avoir au moins 2 membres (actuellement {members_count})")

        tontine.status = "active"
        db.commit()

    @staticmethod
    def collect_contributions(
        db: Session,
        tontine_id: str,
        cycle_number: int
    ) -> Dict[str, Decimal]:
        """
        Collecte les contributions de tous les membres pour un cycle

        Args:
            db: Session base de données
            tontine_id: ID de la tontine
            cycle_number: Numéro du cycle

        Returns:
            Dict des contributions {user_id: amount}
        """
        members = db.query(TontineMember).filter(
            TontineMember.tontine_id == tontine_id
        ).all()

        contributions = {}

        for member in members:
            # Débiter le compte du membre
            # TODO: Implémenter le débit automatique
            # Pour l'instant, on assume que la contribution est faite manuellement
            contributions[str(member.user_id)] = Decimal(member.contribution_amount)

        return contributions

    @staticmethod
    def select_recipient(
        db: Session,
        tontine_id: str,
        cycle_number: int,
        method: str = "rotating"
    ) -> str:
        """
        Sélectionne le bénéficiaire du cycle

        Args:
            db: Session base de données
            tontine_id: ID de la tontine
            cycle_number: Numéro du cycle
            method: Méthode de sélection (rotating, random, vote)

        Returns:
            user_id du bénéficiaire
        """
        members = db.query(TontineMember).filter(
            TontineMember.tontine_id == tontine_id
        ).all()

        if method == "rotating":
            # Rotation basée sur l'ordre
            # Cycle 1 -> member order 1, Cycle 2 -> member order 2, etc.
            members_sorted = sorted(members, key=lambda m: int(m.order))
            index = (cycle_number - 1) % len(members_sorted)
            return str(members_sorted[index].user_id)

        elif method == "random":
            # Sélection aléatoire parmi ceux qui n'ont pas encore reçu
            # TODO: Tracker les bénéficiaires précédents
            return str(random.choice(members).user_id)

        elif method == "vote":
            # Système de vote (à implémenter)
            # TODO: Implémenter un système de vote
            return str(members[0].user_id)

        else:
            raise ValueError(f"Méthode de sélection inconnue: {method}")

    @staticmethod
    def distribute(
        db: Session,
        tontine_id: str,
        cycle_number: int
    ) -> Transaction:
        """
        Distribue les fonds du cycle au bénéficiaire

        Args:
            db: Session base de données
            tontine_id: ID de la tontine
            cycle_number: Numéro du cycle

        Returns:
            Transaction de distribution
        """
        tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
        if not tontine:
            raise ValueError("Tontine non trouvée")

        # Verifier qu'il y a des membres
        members = db.query(TontineMember).filter(
            TontineMember.tontine_id == tontine_id
        ).all()
        if not members:
            raise ValueError("La tontine n'a aucun membre")

        # Collecter les contributions
        contributions = TontineEngine.collect_contributions(db, tontine_id, cycle_number)

        # Calculer le total
        total_amount = sum(contributions.values())
        if total_amount <= 0:
            raise ValueError("Le montant total des contributions est zero")

        # Sélectionner le bénéficiaire
        method = tontine.distribution_method or "rotating"
        recipient_user_id = TontineEngine.select_recipient(db, tontine_id, cycle_number, method)

        # Trouver le compte du bénéficiaire
        recipient_account = db.query(Account).filter(
            Account.user_id == recipient_user_id,
            Account.status == "active"
        ).first()

        if not recipient_account:
            raise ValueError("Compte du bénéficiaire non trouvé")

        # Créer la transaction de distribution
        from app.banking import TransactionEngine

        distribution_tx = TransactionEngine.deposit(
            db=db,
            account_id=str(recipient_account.id),
            amount=total_amount,
            currency=tontine.base_currency if hasattr(tontine, 'base_currency') else "XOF",
            reference=f"Tontine {tontine.name} - Cycle {cycle_number}"
        )

        # Creer un enregistrement TontineCycle
        cycle = TontineCycle(
            tontine_id=tontine_id,
            cycle_number=cycle_number,
            recipient_user_id=recipient_user_id,
            amount=str(total_amount),
            currency=tontine.base_currency if hasattr(tontine, 'base_currency') else "XOF",
            disbursement_date=datetime.utcnow(),
            status="paid"
        )
        db.add(cycle)
        db.commit()

        return distribution_tx

    @staticmethod
    def get_next_cycle_date(frequency: str, last_cycle_date: Optional[datetime] = None) -> datetime:
        """
        Calcule la date du prochain cycle

        Args:
            frequency: Fréquence (weekly, monthly)
            last_cycle_date: Date du dernier cycle (None pour le premier)

        Returns:
            Date du prochain cycle
        """
        base_date = last_cycle_date or datetime.utcnow()

        if frequency == "weekly":
            return base_date + timedelta(weeks=1)
        elif frequency == "monthly":
            # Ajouter un mois
            month = base_date.month + 1
            year = base_date.year

            if month > 12:
                month = 1
                year += 1

            return base_date.replace(year=year, month=month)
        else:
            raise ValueError(f"Fréquence inconnue: {frequency}")

    @staticmethod
    def get_tontine_status(db: Session, tontine_id: str) -> dict:
        """
        Récupère le statut détaillé d'une tontine

        Args:
            db: Session base de données
            tontine_id: ID de la tontine

        Returns:
            Dict avec les informations de la tontine
        """
        tontine = db.query(Tontine).filter(Tontine.id == tontine_id).first()
        if not tontine:
            raise ValueError("Tontine non trouvée")

        members = db.query(TontineMember).filter(
            TontineMember.tontine_id == tontine_id
        ).all()

        # Calculer total des contributions
        total_contributions = sum(Decimal(m.contribution_amount) for m in members)

        return {
            "tontine_id": str(tontine.id),
            "name": tontine.name,
            "status": tontine.status,
            "frequency": tontine.frequency,
            "target_amount": Decimal(tontine.target_amount),
            "members_count": len(members),
            "total_per_cycle": total_contributions,
            "admin_id": str(tontine.admin_id),
            "created_at": tontine.created_at.isoformat() if tontine.created_at else None,
            "members": [
                {
                    "user_id": str(m.user_id),
                    "contribution": Decimal(m.contribution_amount),
                    "order": int(m.order),
                    "joined_at": m.joined_at.isoformat() if m.joined_at else None
                }
                for m in sorted(members, key=lambda x: int(x.order))
            ]
        }

    @staticmethod
    def check_and_trigger_cycles(db: Session):
        """
        Vérifie toutes les tontines actives et déclenche les cycles si nécessaire
        À appeler via un cron job quotidien

        Args:
            db: Session base de données
        """
        active_tontines = db.query(Tontine).filter(Tontine.status == "active").all()

        for tontine in active_tontines:
            # TODO: Vérifier la date du dernier cycle
            # TODO: Si la date est dépassée, déclencher un nouveau cycle
            # TODO: Notifier les membres
            pass

    @staticmethod
    def notify_members(db: Session, tontine_id: str, message: str):
        """
        Notifie tous les membres d'une tontine

        Args:
            db: Session base de données
            tontine_id: ID de la tontine
            message: Message à envoyer
        """
        members = db.query(TontineMember).filter(
            TontineMember.tontine_id == tontine_id
        ).all()

        # Publier notification via Redis pour WebSocket
        import redis
        import json
        import os

        redis_client = redis.Redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            decode_responses=True
        )

        for member in members:
            event = {
                "user_id": str(member.user_id),
                "title": "Tontine Notification",
                "message": message,
                "tontine_id": str(tontine_id)
            }
            redis_client.publish("notification.new", json.dumps(event))

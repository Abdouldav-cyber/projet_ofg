"""
Moteur de transactions avec pattern Saga pour Djembé Bank
Gère les virements sécurisés avec rollback automatique
"""
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from app.models import Account, AccountBalance, LedgerEntry, Transaction
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Optional, Dict
from enum import Enum
import json
import redis
import os


class TransactionState(str, Enum):
    """États du Saga de transaction"""
    INITIATED = "initiated"
    VALIDATED = "validated"
    RESERVED = "reserved"
    EXECUTED = "executed"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class TransactionSaga:
    """
    Orchestrateur Saga pour transactions distribuées
    Gère le cycle de vie complet d'une transaction avec compensation
    """

    def __init__(self, db: Session, from_account_id: str, to_account_id: str,
                 amount: Decimal, currency: str, reference: str = "",
                 transaction_type: str = "internal"):
        self.db = db
        self.from_account_id = from_account_id
        self.to_account_id = to_account_id
        self.amount = amount
        self.currency = currency
        self.reference = reference
        self.transaction_type = transaction_type
        self.state = TransactionState.INITIATED
        self.transaction: Optional[Transaction] = None
        self.redis_client = redis.Redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            decode_responses=True
        )

    async def validate(self) -> bool:
        """
        Étape 1: Validation des comptes et montants
        """
        # Vérifier que from_account existe et est actif
        from_account = self.db.query(Account).filter(Account.id == self.from_account_id).first()
        if not from_account:
            raise ValueError("Compte émetteur introuvable")

        if from_account.status != "active":
            raise ValueError(f"Compte émetteur inactif (statut: {from_account.status})")

        # Résoudre to_account (peut être UUID ou IBAN)
        to_account = self._resolve_account(self.to_account_id)
        if not to_account:
            raise ValueError("Compte destinataire introuvable")

        if to_account.status not in ["active"]:
            raise ValueError(f"Compte destinataire inactif (statut: {to_account.status})")

        # Vérifier montant positif
        if self.amount <= 0:
            raise ValueError("Le montant doit être positif")

        self.state = TransactionState.VALIDATED
        return True

    async def check_balance(self) -> bool:
        """
        Étape 2: Vérification des fonds et limites
        """
        # Vérifier solde disponible
        balance = self.db.query(AccountBalance).filter(
            AccountBalance.account_id == self.from_account_id,
            AccountBalance.currency == self.currency
        ).first()

        if not balance or Decimal(balance.available) < self.amount:
            available = Decimal(balance.available) if balance else Decimal(0)
            raise ValueError(f"Fonds insuffisants (Disponible: {available} {self.currency})")

        # Vérifier limites journalières
        from_account = self.db.query(Account).filter(Account.id == self.from_account_id).first()
        daily_limit = Decimal(from_account.daily_limit) if from_account.daily_limit else None

        if daily_limit:
            # Calculer total des transactions du jour
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            today_total = self.db.query(
                func.sum(text("CAST(amount AS NUMERIC)"))
            ).filter(
                Transaction.from_account_id == self.from_account_id,
                Transaction.currency == self.currency,
                Transaction.created_at >= today_start,
                Transaction.status.in_(["completed", "pending"])
            ).scalar() or Decimal(0)

            if today_total + self.amount > daily_limit:
                raise ValueError(
                    f"Limite journalière dépassée (Limite: {daily_limit}, "
                    f"Utilisé: {today_total}, Tentative: {self.amount})"
                )

        return True

    async def reserve_funds(self) -> bool:
        """
        Étape 3: Réservation des fonds (mise en pending)
        """
        balance = self.db.query(AccountBalance).filter(
            AccountBalance.account_id == self.from_account_id,
            AccountBalance.currency == self.currency
        ).with_for_update().first()

        # Transférer de available vers pending
        current_available = Decimal(balance.available)
        current_pending = Decimal(balance.pending)

        balance.available = str(current_available - self.amount)
        balance.pending = str(current_pending + self.amount)

        # Stocker la réservation dans Redis avec timeout (5 minutes)
        reservation_key = f"tx_reservation:{self.from_account_id}:{self.currency}"
        self.redis_client.setex(
            reservation_key,
            300,  # 5 minutes
            str(self.amount)
        )

        self.state = TransactionState.RESERVED
        self.db.flush()
        return True

    async def execute(self) -> Transaction:
        """
        Étape 4: Exécution de la transaction (double-entrée)
        """
        # Créer l'enregistrement de transaction
        self.transaction = Transaction(
            from_account_id=self.from_account_id,
            to_account_id=self.to_account_id,
            amount=str(self.amount),
            currency=self.currency,
            reference=self.reference,
            transaction_type=self.transaction_type,
            status="pending"
        )
        self.db.add(self.transaction)
        self.db.flush()

        # Débiter l'expéditeur (retirer de pending)
        from_balance = self.db.query(AccountBalance).filter(
            AccountBalance.account_id == self.from_account_id,
            AccountBalance.currency == self.currency
        ).with_for_update().first()

        current_pending = Decimal(from_balance.pending)
        new_from_balance = Decimal(from_balance.available)
        from_balance.pending = str(current_pending - self.amount)

        # Enregistrement ledger DEBIT
        self.db.add(LedgerEntry(
            account_id=self.from_account_id,
            transaction_id=self.transaction.id,
            entry_type="DEBIT",
            amount=str(self.amount),
            currency=self.currency,
            balance_after=str(new_from_balance)
        ))

        # Créditer le destinataire
        to_balance = self.db.query(AccountBalance).filter(
            AccountBalance.account_id == self.to_account_id,
            AccountBalance.currency == self.currency
        ).with_for_update().first()

        if not to_balance:
            to_balance = AccountBalance(
                account_id=self.to_account_id,
                currency=self.currency,
                available="0",
                pending="0"
            )
            self.db.add(to_balance)
            self.db.flush()

        current_to_balance = Decimal(to_balance.available)
        new_to_balance = current_to_balance + self.amount
        to_balance.available = str(new_to_balance)

        # Enregistrement ledger CREDIT
        self.db.add(LedgerEntry(
            account_id=self.to_account_id,
            transaction_id=self.transaction.id,
            entry_type="CREDIT",
            amount=str(self.amount),
            currency=self.currency,
            balance_after=str(new_to_balance)
        ))

        self.state = TransactionState.EXECUTED
        self.db.flush()
        return self.transaction

    async def complete(self) -> Transaction:
        """
        Étape 5: Finalisation de la transaction
        """
        self.transaction.status = "completed"

        # Nettoyer la réservation Redis
        reservation_key = f"tx_reservation:{self.from_account_id}:{self.currency}"
        self.redis_client.delete(reservation_key)

        self.state = TransactionState.COMPLETED
        self.db.commit()

        # Publier événement Kafka (async)
        await self._publish_event()

        # Ancrer sur la Blockchain si montant significatif ou international
        if self.amount >= 500000 or self.transaction_type in ["international", "cross_border"]:
            from app.blockchain import blockchain_service
            try:
                await blockchain_service.anchor_transaction(
                    transaction_id=str(self.transaction.id),
                    amount=str(self.amount),
                    currency=self.currency,
                    sender=str(self.from_account_id),
                    receiver=str(self.to_account_id)
                )
            except Exception as e:
                print(f"Erreur ancrage blockchain: {e}")

        return self.transaction

    async def rollback(self):
        """
        Compensation en cas d'erreur
        Restaure les soldes réservés
        """
        if self.state in [TransactionState.RESERVED, TransactionState.EXECUTED]:
            # Restaurer les fonds de pending vers available
            balance = self.db.query(AccountBalance).filter(
                AccountBalance.account_id == self.from_account_id,
                AccountBalance.currency == self.currency
            ).with_for_update().first()

            if balance:
                current_available = Decimal(balance.available)
                current_pending = Decimal(balance.pending)

                balance.available = str(current_available + self.amount)
                balance.pending = str(current_pending - self.amount)

            # Marquer la transaction comme échouée
            if self.transaction:
                self.transaction.status = "failed"

            self.state = TransactionState.ROLLED_BACK
            self.db.commit()

            # Nettoyer Redis
            reservation_key = f"tx_reservation:{self.from_account_id}:{self.currency}"
            self.redis_client.delete(reservation_key)

    async def _publish_event(self):
        """
        Publie un événement Kafka/Redis pour notification
        """
        try:
            # Récupérer les user_ids pour WebSocket
            from_account = self.db.query(Account).filter(Account.id == self.from_account_id).first()
            to_account = self.db.query(Account).filter(Account.id == self.to_account_id).first()

            # Événement transaction.completed
            transaction_event = {
                "type": "transaction.completed",
                "transaction_id": str(self.transaction.id),
                "from_account": self.from_account_id,
                "to_account": self.to_account_id,
                "from_user_id": str(from_account.user_id) if from_account else None,
                "to_user_id": str(to_account.user_id) if to_account else None,
                "amount": str(self.amount),
                "currency": self.currency,
                "timestamp": datetime.utcnow().isoformat()
            }
            self.redis_client.publish("transactions.completed", json.dumps(transaction_event))

            # Événement account.updated pour émetteur
            if from_account:
                from_balance = self.db.query(AccountBalance).filter(
                    AccountBalance.account_id == self.from_account_id,
                    AccountBalance.currency == self.currency
                ).first()

                account_update_event = {
                    "user_id": str(from_account.user_id),
                    "account_id": self.from_account_id,
                    "balance": from_balance.available if from_balance else "0",
                    "currency": self.currency
                }
                self.redis_client.publish("account.updated", json.dumps(account_update_event))

            # Événement account.updated pour destinataire
            if to_account:
                to_balance = self.db.query(AccountBalance).filter(
                    AccountBalance.account_id == self.to_account_id,
                    AccountBalance.currency == self.currency
                ).first()

                account_update_event = {
                    "user_id": str(to_account.user_id),
                    "account_id": self.to_account_id,
                    "balance": to_balance.available if to_balance else "0",
                    "currency": self.currency
                }
                self.redis_client.publish("account.updated", json.dumps(account_update_event))

        except Exception as e:
            # Ne pas bloquer la transaction si la publication échoue
            print(f"Erreur publication événement: {e}")

    def _resolve_account(self, account_identifier: str) -> Optional[Account]:
        """
        Résout un compte par UUID ou IBAN
        """
        try:
            import uuid
            uuid.UUID(str(account_identifier))
            return self.db.query(Account).filter(Account.id == account_identifier).first()
        except ValueError:
            return self.db.query(Account).filter(Account.iban == account_identifier).first()


class TransactionEngine:
    """
    Moteur de traitement des flux financiers
    Interface publique pour les transactions
    """

    @staticmethod
    def get_balance(db: Session, account_id: str, currency: str) -> Decimal:
        """Récupère le solde disponible pour un compte et une devise donnée"""
        balance = db.query(AccountBalance).filter(
            AccountBalance.account_id == account_id,
            AccountBalance.currency == currency
        ).first()
        return Decimal(balance.available) if balance else Decimal(0)

    @staticmethod
    async def execute_transfer(
        db: Session,
        from_account_id: str,
        to_account_id: str,
        amount: Decimal,
        currency: str,
        reference: str = "",
        transaction_type: str = "internal"
    ) -> Transaction:
        """
        Exécute un virement avec pattern Saga
        Rollback automatique en cas d'erreur
        """
        saga = TransactionSaga(
            db=db,
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            amount=amount,
            currency=currency,
            reference=reference,
            transaction_type=transaction_type
        )

        try:
            # Pipeline Saga
            await saga.validate()
            await saga.check_balance()
            await saga.reserve_funds()
            await saga.execute()
            await saga.complete()

            return saga.transaction

        except Exception as e:
            # Rollback automatique
            await saga.rollback()
            raise e

    @staticmethod
    def deposit(
        db: Session,
        account_id: str,
        amount: Decimal,
        currency: str,
        reference: str = "Depot"
    ) -> Transaction:
        """
        Crédite un compte (dépôt physique ou test)
        """
        to_balance = db.query(AccountBalance).filter(
            AccountBalance.account_id == account_id,
            AccountBalance.currency == currency
        ).with_for_update().first()

        if not to_balance:
            to_balance = AccountBalance(
                account_id=account_id,
                currency=currency,
                available="0",
                pending="0"
            )
            db.add(to_balance)
            db.flush()

        old_bal = Decimal(to_balance.available)
        new_bal = old_bal + amount
        to_balance.available = str(new_bal)

        # Transaction record
        new_tx = Transaction(
            to_account_id=account_id,
            amount=str(amount),
            currency=currency,
            reference=reference,
            transaction_type="deposit",
            status="completed"
        )
        db.add(new_tx)
        db.flush()

        # Ledger entry
        db.add(LedgerEntry(
            account_id=account_id,
            transaction_id=new_tx.id,
            entry_type="CREDIT",
            amount=str(amount),
            currency=currency,
            balance_after=str(new_bal)
        ))

        db.commit()
        return new_tx

    @staticmethod
    def get_daily_transaction_total(
        db: Session,
        account_id: str,
        currency: str
    ) -> Decimal:
        """
        Calcule le total des transactions du jour
        """
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        total = db.query(
            func.sum(text("CAST(amount AS NUMERIC)"))
        ).filter(
            Transaction.from_account_id == account_id,
            Transaction.currency == currency,
            Transaction.created_at >= today_start,
            Transaction.status.in_(["completed", "pending"])
        ).scalar()

        return Decimal(total) if total else Decimal(0)

    @staticmethod
    def get_monthly_transaction_total(
        db: Session,
        account_id: str,
        currency: str
    ) -> Decimal:
        """
        Calcule le total des transactions du mois
        """
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total = db.query(
            func.sum(text("CAST(amount AS NUMERIC)"))
        ).filter(
            Transaction.from_account_id == account_id,
            Transaction.currency == currency,
            Transaction.created_at >= month_start,
            Transaction.status.in_(["completed", "pending"])
        ).scalar()

        return Decimal(total) if total else Decimal(0)

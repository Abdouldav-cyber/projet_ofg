from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import Account, AccountBalance, LedgerEntry, Transaction
from decimal import Decimal
import json

class TransactionEngine:
    """Moteur de traitement des flux financiers garantissant l'atomicité via le pattern Saga."""
    @staticmethod
    def get_balance(db: Session, account_id: str, currency: str) -> Decimal:
        """Récupère le solde disponible pour un compte et une devise donnée."""
        balance = db.query(AccountBalance).filter(
            AccountBalance.account_id == account_id,
            AccountBalance.currency == currency
        ).first()
        return Decimal(balance.available) if balance else Decimal(0)

    @staticmethod
    def execute_transfer(db: Session, from_acc_id: str, to_acc_id: str, amount: Decimal, currency: str, reference: str):
        """Exécute un virement sécurisé avec mise à jour du grand livre (Ledger)."""
        # Résolution du compte destinataire si nécessaire (ID ou IBAN)
        # On vérifie si c'est un UUID valide pour éviter l'erreur de conversion Postgres
        is_uuid = True
        try:
            import uuid
            uuid.UUID(str(to_acc_id))
        except ValueError:
            is_uuid = False

        if is_uuid:
            target_account = db.query(Account).filter(Account.id == to_acc_id).first()
        else:
            target_account = db.query(Account).filter(Account.iban == to_acc_id).first()
        
        if not target_account:
            raise ValueError("Compte destinataire introuvable")

        actual_to_acc_id = str(target_account.id)
        # 1. Début de la transaction atomique
        try:
            # 2. Vérification et Débit de l'expéditeur (Verrouillage ligne pour éviter double dépense)
            from_balance = db.query(AccountBalance).filter(
                AccountBalance.account_id == from_acc_id,
                AccountBalance.currency == currency
            ).with_for_update().first()

            if not from_balance or Decimal(from_balance.available) < amount:
                raise ValueError(f"Fonds insuffisants (Solde disponible: {from_balance.available if from_balance else 0} {currency})")

            # 3. Création de l'enregistrement de transaction
            new_tx = Transaction(
                from_account_id=from_acc_id,
                to_account_id=actual_to_acc_id,
                amount=str(amount),
                currency=currency,
                reference=reference,
                transaction_type="internal",
                status="completed"
            )
            db.add(new_tx)
            db.flush()

            # 4. Mise à jour du solde expéditeur & Grand Livre
            old_from_bal = Decimal(from_balance.available)
            new_from_bal = old_from_bal - amount
            from_balance.available = str(new_from_bal)
            
            db.add(LedgerEntry(
                account_id=from_acc_id,
                transaction_id=new_tx.id,
                entry_type="DEBIT",
                amount=str(amount),
                currency=currency,
                balance_after=str(new_from_bal)
            ))

            # 5. Mise à jour du solde destinataire & Grand Livre
            to_balance = db.query(AccountBalance).filter(
                AccountBalance.account_id == actual_to_acc_id,
                AccountBalance.currency == currency
            ).with_for_update().first()

            if not to_balance:
                to_balance = AccountBalance(account_id=to_acc_id, currency=currency, available="0")
                db.add(to_balance)

            old_to_bal = Decimal(to_balance.available)
            new_to_bal = old_to_bal + amount
            to_balance.available = str(new_to_bal)

            db.add(LedgerEntry(
                account_id=actual_to_acc_id,
                transaction_id=new_tx.id,
                entry_type="CREDIT",
                amount=str(amount),
                currency=currency,
                balance_after=str(new_to_bal)
            ))

            db.commit()
            return new_tx
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def deposit(db: Session, account_id: str, amount: Decimal, currency: str, reference: str = "Depot"):
        """Crédite un compte (pour test ou dépôt physique)."""
        to_balance = db.query(AccountBalance).filter(
            AccountBalance.account_id == account_id,
            AccountBalance.currency == currency
        ).with_for_update().first()

        if not to_balance:
            to_balance = AccountBalance(account_id=account_id, currency=currency, available="0")
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

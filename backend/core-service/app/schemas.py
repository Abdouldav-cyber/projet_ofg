from pydantic import BaseModel, UUID4, Field
from datetime import datetime
from typing import Optional, List

class TenantBase(BaseModel):
    """Schéma de base pour un pays (Tenant)."""
    name: str # Nom du pays (ex: Sénégal)
    country_code: str # Code ISO (ex: SN)
    regulatory_authority: Optional[str] = None # Autorité de régulation (ex: BCEAO)
    base_currency: Optional[str] = "XOF" # Devise locale par défaut

class TenantCreate(TenantBase):
    """Schema de creation d'un pays."""
    name: str = Field(..., example="Senegal")
    country_code: str = Field(..., example="SN")

class TenantUpdate(TenantBase):
    name: Optional[str] = None
    country_code: Optional[str] = None
    status: Optional[str] = None

class TenantResponse(TenantBase):
    tenant_id: UUID4
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    """Donnees requises pour la creation d'un utilisateur."""
    email: str = Field(..., example="jean.dupont@example.com")
    phone: str = Field(..., example="+221770000000")
    password: str = Field(..., example="Securite123!")
    full_name: str = Field(..., example="Jean Dupont")

class UserResponse(BaseModel):
    id: UUID4
    email: str
    phone: str
    full_name: str
    role: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    tenant_code: str

class TokenData(BaseModel):
    email: Optional[str] = None
    tenant_code: Optional[str] = None

class AccountCreate(BaseModel):
    """Schema de creation de compte."""
    account_type: str = Field(..., example="personal", description="Type de compte: personal, business, savings, tontine")
    initial_currency: Optional[str] = Field("XOF", example="XOF")

class AccountBalanceResponse(BaseModel):
    currency: str
    available: float
    pending: float

class AccountResponse(BaseModel):
    """Détails d'un compte bancaire."""
    id: UUID4
    account_type: str
    iban: Optional[str]
    status: str
    created_at: datetime
    balances: Optional[List[AccountBalanceResponse]] = []

    class Config:
        from_attributes = True

class TransactionCreate(BaseModel):
    """Donnees pour initier un virement."""
    from_account_id: UUID4 = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    to_account_id: str = Field(..., example="SN890001234567890123456", description="Identifiant du destinataire ou IBAN")
    amount: float = Field(..., example=5000.0)
    currency: str = Field("XOF", example="XOF")
    reference: Optional[str] = Field(None, example="Cadeau anniversaire")

class TransactionResponse(BaseModel):
    id: UUID4
    from_account_id: Optional[UUID4]
    to_account_id: Optional[UUID4]
    amount: float
    currency: str
    reference: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class TontineCreate(BaseModel):
    name: str
    target_amount: float
    frequency: str # weekly, monthly

class TontineResponse(BaseModel):
    id: UUID4
    name: str
    admin_id: UUID4
    target_amount: float
    frequency: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class TontineMemberCreate(BaseModel):
    user_id: UUID4
    contribution_amount: float

class TontineMemberResponse(BaseModel):
    id: UUID4
    tontine_id: UUID4
    user_id: UUID4
    contribution_amount: float
    order: Optional[int]
    joined_at: datetime

    class Config:
        from_attributes = True

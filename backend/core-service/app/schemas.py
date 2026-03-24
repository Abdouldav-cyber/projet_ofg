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
    password: str = Field(..., example="Securite123!")
    first_name: str = Field(..., example="Jean")
    last_name: str = Field(..., example="Dupont")
    phone: Optional[str] = Field(None, example="+221770000000")
    role: Optional[str] = Field("user", example="user", description="Role: user, support_l1, support_l2, country_admin, super_admin")

class UserResponse(BaseModel):
    id: UUID4
    email: str
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    is_active: bool
    kyc_status: str
    created_at: datetime
    tenant_id: Optional[str] = None

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
    user_id: Optional[str] = Field(None, example="550e8400-e29b-41d4-a716-446655440000", description="ID de l'utilisateur (admin peut specifier)")
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


# --- SUPPORT TICKETS ---

class SupportTicketCreate(BaseModel):
    """Schema de creation d'un ticket de support."""
    subject: str = Field(..., example="Probleme de connexion")
    description: str = Field(..., example="Je n'arrive pas a acceder a mon compte")
    priority: Optional[str] = Field("medium", example="medium", description="low, medium, high, urgent")
    category: Optional[str] = Field("other", example="account", description="account, transaction, kyc, technical, other")

class SupportTicketUpdate(BaseModel):
    """Schema de mise a jour d'un ticket."""
    status: Optional[str] = Field(None, description="open, in_progress, resolved, closed")
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution: Optional[str] = None

class SupportTicketResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    assigned_to: Optional[UUID4] = None
    subject: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority: str
    status: str
    resolution: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- USER UPDATE ---

class UserUpdate(BaseModel):
    """Schema de mise a jour d'un utilisateur."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class PasswordChange(BaseModel):
    """Schema pour changer le mot de passe."""
    current_password: str
    new_password: str = Field(..., min_length=8)

class ProfileUpdate(BaseModel):
    """Schema de mise a jour du profil."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

class TenantUpdate(BaseModel):
    """Schema de mise a jour d'un tenant."""
    name: Optional[str] = None
    regulatory_authority: Optional[str] = None
    base_currency: Optional[str] = None
    status: Optional[str] = None


# --- CHAT LIVE SUPPORT ---

class ChatMessageCreate(BaseModel):
    """Schema d'envoi d'un message chat."""
    ticket_id: UUID4
    message: str = Field(..., min_length=1, max_length=5000)
    message_type: Optional[str] = Field("text", description="text, image, file, system")
    file_url: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: UUID4
    ticket_id: UUID4
    sender_id: UUID4
    sender_role: str
    sender_name: Optional[str] = None
    message: str
    message_type: str
    file_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

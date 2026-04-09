from pydantic import BaseModel, UUID4, Field
from datetime import datetime, date
from typing import Optional, List

class AccountTypeMetadata(BaseModel):
    id: str
    name: str
    price: str
    description: str

class CountryMetadata(BaseModel):
    code: str
    name: str

class OnboardingMetadataResponse(BaseModel):
    countries: List[CountryMetadata]
    account_types: List[AccountTypeMetadata]

class TenantBase(BaseModel):
    """Schéma de base pour un pays (Tenant)."""
    name: str # Nom du pays (ex: Sénégal)
    country_code: str # Code ISO (ex: SN)
    regulatory_authority: Optional[str] = None # Autorité de régulation (ex: BCEAO)
    base_currency: Optional[str] = "XOF" # Devise locale par défaut

class TenantLimits(BaseModel):
    max_transaction: float = Field(..., example=5000000.0)
    daily_withdrawal: Optional[float] = None
    monthly_transfer: Optional[float] = None

class TenantConfig(BaseModel):
    kyc_provider: str = Field(..., example="onfido")
    limits: TenantLimits

class TenantCreate(TenantBase):
    """Schema de creation d'un pays avec parametres reglementaires KYC."""
    name: str = Field(..., example="Senegal")
    country_code: str = Field(..., example="SN")
    config: Optional[TenantConfig] = None

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
    password: str = Field(..., min_length=20, example="Securite123!MotDePasseFort2025")
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
    account_type: str = Field(..., example="courant", description="Type de compte: courant, diaspora, business, savings, tontine")
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
    new_password: str = Field(..., min_length=20)

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

# --- CARTES BANCAIRES ---

class CardCreate(BaseModel):
    account_id: UUID4
    card_type: str = Field(..., description="physical or virtual")

class CardResponse(BaseModel):
    id: UUID4
    account_id: UUID4
    card_type: str
    last_4_digits: str
    expiry_date: date
    status: str
    daily_limit: float
    monthly_limit: float
    apple_pay_enabled: bool
    contactless_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True

class CardSettingsUpdate(BaseModel):
    daily_limit: Optional[float] = None
    monthly_limit: Optional[float] = None
    apple_pay_enabled: Optional[bool] = None
    contactless_enabled: Optional[bool] = None

class CardRevealResponse(BaseModel):
    card_number: str
    cvv: str
    expiry_date: date

# --- EPARGNE ---

class SavingsGoalCreate(BaseModel):
    account_id: UUID4
    name: str
    target_amount: float
    deadline: Optional[date] = None

class SavingsGoalResponse(BaseModel):
    id: UUID4
    account_id: UUID4
    name: str
    target_amount: float
    current_amount: float = 0.0 # Calculé dynamiquement par l'API
    deadline: Optional[date]
    status: str
    created_at: datetime
    progress_percentage: float = 0.0 # Calculé dynamiquement

    class Config:
        from_attributes = True

# --- CERCLE SOCIAL ---

class FriendshipCreate(BaseModel):
    contact_user_id: UUID4

class FriendshipResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    contact_user_id: UUID4
    is_favorite: bool
    status: str
    created_at: datetime
    
    # Détails du contact (ajouté dynamiquement par l'API lors du GET)
    contact_first_name: Optional[str] = None
    contact_last_name: Optional[str] = None

    class Config:
        from_attributes = True

class ReferralResponse(BaseModel):
    id: UUID4
    referrer_id: UUID4
    referred_id: UUID4
    reward_amount: float
    currency: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- INVESTISSEMENTS ---

class InvestmentProjectCreate(BaseModel):
    title: str = Field(..., max_length=200)
    category: str = Field(..., max_length=100)
    annual_yield: float = Field(..., gt=0)
    risk_level: str = Field(..., description="Faible, Modéré, Élevé")
    funding_goal: float = Field(..., gt=0)
    min_investment: float = Field(10.0, gt=0)
    currency: str = Field("XOF", max_length=3)

class InvestmentProjectResponse(BaseModel):
    id: UUID4
    title: str
    category: str
    annual_yield: float
    risk_level: str
    funding_goal: float
    current_funding: float
    min_investment: float
    currency: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ClientInvestmentRequest(BaseModel):
    amount: float = Field(..., gt=0)

class ClientInvestmentResponse(BaseModel):
    id: UUID4
    project_id: UUID4
    user_id: UUID4
    invested_amount: float
    expected_yield: Optional[float] = None
    created_at: datetime
    
    # Détail projet
    project_title: Optional[str] = None
    project_annual_yield: Optional[float] = None

    class Config:
        from_attributes = True


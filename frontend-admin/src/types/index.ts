// Types d'authentification
export interface LoginCredentials {
  email: string
  password: string
  tenant_code: string
}

export interface MFAVerification {
  code: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  mfa_required?: boolean
  temp_token?: string
}

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  role: UserRole
  is_active: boolean
  kyc_status: KYCStatus
  created_at: string
  tenant_id: string
}

export type UserRole = 'super_admin' | 'country_admin' | 'support_l1' | 'support_l2' | 'customer'

export type KYCStatus = 'pending' | 'approved' | 'rejected'

// Types de comptes
export interface Account {
  id: string
  account_number: string
  account_type: AccountType
  balance: number
  currency: string
  status: AccountStatus
  user_id: string
  created_at: string
}

export type AccountType = 'savings' | 'checking' | 'tontine'

export type AccountStatus = 'active' | 'frozen' | 'closed'

// Types de transactions
export interface Transaction {
  id: string
  reference: string
  type: TransactionType
  amount: number
  currency: string
  from_account_id?: string
  to_account_id?: string
  status: TransactionStatus
  saga_state?: SagaState
  created_at: string
  completed_at?: string
  fraud_score?: number
}

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'tontine_contribution'

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export type SagaState = 'INITIATED' | 'VALIDATED' | 'RESERVED' | 'EXECUTED' | 'COMPLETED' | 'ROLLED_BACK'

// Types KYC
export interface KYCDocument {
  id: string
  user_id: string
  document_type: DocumentType
  document_number: string
  document_url: string
  status: KYCStatus
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
  rejection_reason?: string
}

export type DocumentType = 'passport' | 'national_id' | 'drivers_license'

// Types Tontine
export interface Tontine {
  id: string
  name: string
  target_amount: number
  contribution_amount: number
  frequency: TontineFrequency
  distribution_method: DistributionMethod
  max_members: number
  current_members: number
  status: TontineStatus
  current_cycle: number
  created_at: string
}

export type TontineFrequency = 'daily' | 'weekly' | 'monthly'

export type DistributionMethod = 'rotating' | 'random' | 'vote'

export type TontineStatus = 'open' | 'active' | 'completed' | 'cancelled'

// Types Support
export interface SupportTicket {
  id: string
  user_id: string
  subject: string
  description: string
  priority: TicketPriority
  status: TicketStatus
  assigned_to?: string
  created_at: string
  updated_at: string
}

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

// Types Tenant
export interface Tenant {
  id: string
  code: string
  name: string
  currency: string
  status: string
  created_at: string
}

// Types Audit
export interface AuditLog {
  id: string
  action: string
  user_id: string
  user_email: string
  timestamp: string
  ip_address: string
  details: Record<string, any>
  tenant_id: string
}

// Types Dashboard
export interface DashboardStats {
  total_users: number
  active_accounts: number
  today_transactions: number
  total_volume: number
  user_growth: Array<{ date: string; count: number }>
  transaction_volume: Array<{ date: string; volume: number }>
}

// Types Chat Live Support
export interface ChatMessage {
  id: string
  ticket_id: string
  sender_id: string
  sender_role: 'customer' | 'support_l1' | 'support_l2' | 'country_admin' | 'super_admin' | 'system'
  sender_name?: string
  message: string
  message_type: 'text' | 'image' | 'file' | 'system'
  file_url?: string
  is_read: boolean
  created_at: string
}

// Types WebSocket
export interface WebSocketMessage {
  type: 'transaction.completed' | 'account.updated' | 'notification.new' | 'chat.message' | 'chat.typing'
  data: any
  timestamp: string
}

// Types de réponse API
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiError {
  detail: string
  status_code: number
}

import axios, { AxiosInstance, AxiosError } from 'axios'
import { AuthResponse, LoginCredentials, MFAVerification } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class ApiService {
  private api: AxiosInstance
  private tenantCode: string | null = null

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Intercepteur de requête pour ajouter le token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        const tenantCode = this.tenantCode || localStorage.getItem('tenant_code')
        if (tenantCode) {
          config.headers['X-Tenant-Code'] = tenantCode
        }

        return config
      },
      (error) => Promise.reject(error)
    )

    // Intercepteur de réponse pour gérer les erreurs
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expiré ou invalide
          localStorage.removeItem('access_token')
          localStorage.removeItem('tenant_code')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  setTenantCode(code: string) {
    this.tenantCode = code
    localStorage.setItem('tenant_code', code)
  }

  // Authentification
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    this.setTenantCode(credentials.tenant_code)
    const formData = new URLSearchParams()
    formData.append('username', credentials.email)
    formData.append('password', credentials.password)

    const response = await this.api.post<AuthResponse>('/api/v1/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token)
    }

    return response.data
  }

  async verifyMFA(verification: MFAVerification, tempToken: string): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>(
      '/api/v1/auth/verify-mfa',
      verification,
      {
        headers: {
          Authorization: `Bearer ${tempToken}`,
        },
      }
    )

    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token)
    }

    return response.data
  }

  async getCurrentUser() {
    const response = await this.api.get('/api/v1/auth/me')
    return response.data
  }

  logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('tenant_code')
    this.tenantCode = null
  }

  // Utilisateurs
  async getUsers(params?: { page?: number; page_size?: number; search?: string }) {
    const response = await this.api.get('/api/v1/users', { params })
    return response.data
  }

  async getUser(id: string) {
    const response = await this.api.get(`/api/v1/users/${id}`)
    return response.data
  }

  async updateUser(id: string, data: any) {
    const response = await this.api.patch(`/api/v1/users/${id}`, data)
    return response.data
  }

  async activateUser(id: string) {
    const response = await this.api.post(`/api/v1/users/${id}/activate`)
    return response.data
  }

  async deactivateUser(id: string) {
    const response = await this.api.post(`/api/v1/users/${id}/deactivate`)
    return response.data
  }

  async createUser(data: {
    email: string
    password: string
    first_name: string
    last_name: string
    phone?: string
    role?: string
  }) {
    const response = await this.api.post('/api/v1/auth/register', data)
    return response.data
  }

  // MFA (Multi-Factor Authentication)
  async enableMFA() {
    const response = await this.api.post('/api/v1/auth/mfa/enable')
    return response.data
  }

  async verifyMFACode(code: string) {
    const response = await this.api.post('/api/v1/auth/mfa/verify', null, {
      params: { code }
    })
    return response.data
  }

  async disableMFA(password: string) {
    const response = await this.api.post('/api/v1/auth/mfa/disable', null, {
      params: { password }
    })
    return response.data
  }

  async getMFAStatus() {
    const response = await this.api.get('/api/v1/auth/mfa/status')
    return response.data
  }

  // Comptes
  async getAccounts(params?: { page?: number; page_size?: number; search?: string; status?: string; account_type?: string }) {
    const response = await this.api.get('/api/v1/admin/accounts', { params })
    return response.data
  }

  async getAccount(id: string) {
    const response = await this.api.get(`/api/v1/accounts/${id}`)
    return response.data
  }

  async createAccount(data: {
    user_id: string
    account_type: string
    initial_currency: string
  }) {
    const response = await this.api.post('/api/v1/accounts', data)
    return response.data
  }

  async depositMoney(accountId: string, amount: number) {
    const response = await this.api.post(`/api/v1/accounts/${accountId}/deposit`, null, {
      params: { amount }
    })
    return response.data
  }

  async freezeAccount(id: string, reason: string) {
    const response = await this.api.post(`/api/v1/support/accounts/${id}/freeze`, null, {
      params: { reason }
    })
    return response.data
  }

  async unfreezeAccount(id: string) {
    const response = await this.api.post(`/api/v1/support/accounts/${id}/unfreeze`)
    return response.data
  }

  async closeAccount(id: string) {
    const response = await this.api.post(`/api/v1/admin/accounts/${id}/close`)
    return response.data
  }

  // Transactions
  async getTransactions(params?: { page?: number; page_size?: number; status?: string }) {
    const response = await this.api.get('/api/v1/transactions', { params })
    return response.data
  }

  async getTransaction(id: string) {
    const response = await this.api.get(`/api/v1/transactions/${id}`)
    return response.data
  }

  async createTransfer(data: {
    from_account_id: string
    to_account_id: string
    amount: number
    currency: string
    reference?: string
  }) {
    const response = await this.api.post('/api/v1/transfers', data)
    return response.data
  }

  async refundTransaction(id: string, reason: string) {
    const response = await this.api.post(`/api/v1/support/transactions/${id}/refund`, null, {
      params: { reason }
    })
    return response.data
  }

  // Admin Country Transactions
  async getCountryTransactions(params?: { page?: number; page_size?: number; status?: string; limit?: number; offset?: number }) {
    const response = await this.api.get('/api/v1/admin/country/transactions', { params })
    return response.data
  }

  // KYC
  async getKYCDocuments(params?: { page?: number; page_size?: number; status?: string }) {
    const response = await this.api.get('/api/v1/admin/country/kyc', { params })
    return response.data
  }

  async uploadKYCDocument(userId: string, docType: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await this.api.post(`/api/v1/kyc/upload`, formData, {
      params: { user_id: userId, doc_type: docType },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async verifyKYCDocument(documentId: string, approved: boolean, rejectionReason?: string) {
    const response = await this.api.post(`/api/v1/admin/country/kyc/${documentId}/verify`, null, {
      params: {
        approved,
        rejection_reason: rejectionReason
      }
    })
    return response.data
  }

  async approveKYC(documentId: string) {
    return this.verifyKYCDocument(documentId, true)
  }

  async rejectKYC(documentId: string, reason: string) {
    return this.verifyKYCDocument(documentId, false, reason)
  }

  // Tontines
  async getTontines(params?: { page?: number; page_size?: number }) {
    const response = await this.api.get('/api/v1/admin/tontines', { params })
    return response.data
  }

  async getTontine(id: string) {
    const response = await this.api.get(`/api/v1/admin/tontines/${id}/status`)
    return response.data
  }

  async createTontine(data: {
    name: string
    target_amount: number
    frequency: string
  }) {
    const response = await this.api.post('/api/v1/tontines', data)
    return response.data
  }

  async addTontineMember(tontineId: string, data: {
    user_id: string
    contribution_amount: number
  }) {
    const response = await this.api.post(`/api/v1/tontines/${tontineId}/members`, data)
    return response.data
  }

  async getTontineMembers(tontineId: string) {
    const response = await this.api.get(`/api/v1/tontines/${tontineId}/members`)
    return response.data
  }

  async getTontineCycles(tontineId: string) {
    const response = await this.api.get(`/api/v1/admin/tontines/${tontineId}/cycles`)
    return response.data
  }

  async triggerTontineCycle(tontineId: string) {
    const response = await this.api.post(`/api/v1/admin/tontines/${tontineId}/cycles/trigger`)
    return response.data
  }

  async startTontine(tontineId: string) {
    const response = await this.api.post(`/api/v1/admin/tontines/${tontineId}/start`)
    return response.data
  }

  async getTontineStatus(tontineId: string) {
    const response = await this.api.get(`/api/v1/admin/tontines/${tontineId}/status`)
    return response.data
  }

  // Dashboard
  async getDashboardStats() {
    const response = await this.api.get('/api/v1/admin/country/analytics')
    return response.data
  }

  // Admin Country Users
  async getCountryUsers(params?: { status?: string; limit?: number; offset?: number }) {
    const response = await this.api.get('/api/v1/admin/country/users', { params })
    return response.data
  }

  // Support Operations
  async getUserDetailsBySupport(userId: string) {
    const response = await this.api.get(`/api/v1/support/users/${userId}`)
    return response.data
  }

  // Support Tickets
  async getTickets(params?: { page?: number; page_size?: number; search?: string; status?: string; priority?: string }) {
    const response = await this.api.get('/api/v1/support/tickets', { params })
    return response.data
  }

  async getTicket(id: string) {
    const response = await this.api.get(`/api/v1/support/tickets/${id}`)
    return response.data
  }

  async createTicket(data: { subject: string; description: string; priority?: string; category?: string }) {
    const response = await this.api.post('/api/v1/support/tickets', data)
    return response.data
  }

  async updateTicket(id: string, data: { status?: string; priority?: string; assigned_to?: string; resolution?: string }) {
    const response = await this.api.patch(`/api/v1/support/tickets/${id}`, data)
    return response.data
  }

  async deleteTicket(id: string) {
    const response = await this.api.delete(`/api/v1/support/tickets/${id}`)
    return response.data
  }

  // Profile & Settings
  async updateProfile(data: { first_name?: string; last_name?: string; phone?: string }) {
    const response = await this.api.patch('/api/v1/auth/profile', data)
    return response.data
  }

  async changePassword(data: { current_password: string; new_password: string }) {
    const response = await this.api.post('/api/v1/auth/change-password', data)
    return response.data
  }

  // Tenants (Super Admin uniquement)
  async getTenants(params?: { page?: number; page_size?: number }) {
    const response = await this.api.get('/api/v1/tenants', { params })
    return response.data
  }

  async createTenant(data: {
    name: string
    country_code: string
    regulatory_authority?: string
    base_currency?: string
    config?: any
  }) {
    const response = await this.api.post('/api/v1/admin/tenants', data)
    return response.data
  }

  async getTenantAnalytics(tenantId: string) {
    const response = await this.api.get(`/api/v1/admin/tenants/${tenantId}/analytics`)
    return response.data
  }

  async updateTenant(id: string, data: { name?: string; regulatory_authority?: string; base_currency?: string; status?: string }) {
    const response = await this.api.patch(`/api/v1/admin/tenants/${id}`, data)
    return response.data
  }

  async deleteTenant(id: string) {
    const response = await this.api.delete(`/api/v1/admin/tenants/${id}`)
    return response.data
  }

  async getTenantConfig(tenantId: string) {
    const response = await this.api.get(`/api/v1/admin/tenants/${tenantId}/config`)
    return response.data
  }

  async updateTenantConfig(tenantId: string, config: Record<string, any>) {
    const response = await this.api.patch(`/api/v1/admin/tenants/${tenantId}/config`, config)
    return response.data
  }

  // Notifications
  async sendNotification(userId: string, channel: string, message: string, subject?: string) {
    const response = await this.api.post('/api/v1/notifications/send', null, {
      params: { user_id: userId, channel, message, subject }
    })
    return response.data
  }

  async broadcastNotification(message: string) {
    const response = await this.api.post('/api/v1/notifications/broadcast', null, {
      params: { message }
    })
    return response.data
  }

  // Audit Logs
  async getAuditLogs(params?: {
    limit?: number
    offset?: number
    action?: string
    user_id?: string
  }) {
    const response = await this.api.get('/api/v1/admin/audit-logs', { params })
    return response.data
  }

  // Rapports
  async getCountryReport(params: { period: 'daily' | 'weekly' | 'monthly' }) {
    const response = await this.api.get('/api/v1/admin/country/reports', { params })
    return response.data
  }

  async exportReport(reportType: string, format: 'pdf' | 'csv' | 'excel', period: string = 'monthly') {
    const response = await this.api.get('/api/v1/admin/country/reports/export', {
      params: { report_type: reportType, format, period },
      responseType: 'blob',
    })
    return response.data
  }

  downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.URL.revokeObjectURL(url)
  }

  // Notifications / Testing
  async testSMS(phone: string) {
    const response = await this.api.post('/api/v1/notifications/test-sms', null, {
      params: { phone }
    })
    return response.data
  }

  // Chat Live Support
  async getChatMessages(ticketId: string, params?: { limit?: number; offset?: number }) {
    const response = await this.api.get(`/api/v1/chat/tickets/${ticketId}/messages`, { params })
    return response.data
  }

  async sendChatMessage(ticketId: string, data: { message: string; message_type?: string; file_url?: string }) {
    const response = await this.api.post(`/api/v1/chat/tickets/${ticketId}/messages`, {
      ticket_id: ticketId,
      ...data
    })
    return response.data
  }

  async markMessagesRead(ticketId: string) {
    const response = await this.api.patch(`/api/v1/chat/tickets/${ticketId}/messages/read`)
    return response.data
  }

  async getUnreadCount(ticketId: string) {
    const response = await this.api.get(`/api/v1/chat/tickets/${ticketId}/unread-count`)
    return response.data
  }

  async getTotalUnread() {
    const response = await this.api.get('/api/v1/chat/unread-total')
    return response.data
  }

  async sendTypingIndicator(ticketId: string) {
    const response = await this.api.post(`/api/v1/chat/tickets/${ticketId}/typing`)
    return response.data
  }

  // Conversion Devises
  async getExchangeRates(base: string = 'XOF') {
    const response = await this.api.get('/api/v1/currency/rates', { params: { base } })
    return response.data
  }

  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string) {
    const response = await this.api.post('/api/v1/currency/convert', null, {
      params: { amount, from_currency: fromCurrency, to_currency: toCurrency }
    })
    return response.data
  }

  // Health Check
  async healthCheck() {
    const response = await this.api.get('/api/v1/health')
    return response.data
  }
}

export const apiService = new ApiService()
export default apiService

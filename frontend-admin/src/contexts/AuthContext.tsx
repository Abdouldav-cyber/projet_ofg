import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '@/services/api'
import { User, LoginCredentials, MFAVerification } from '@/types'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<{ mfaRequired: boolean; tempToken?: string }>
  verifyMFA: (verification: MFAVerification, tempToken: string) => Promise<void>
  logout: () => void
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté
    const token = localStorage.getItem('access_token')
    if (token) {
      loadUser()
    } else {
      setIsLoading(false)
    }
  }, [])

  const loadUser = async () => {
    try {
      const userData = await apiService.getCurrentUser()
      setUser(userData)
    } catch (error) {
      console.error('Erreur lors du chargement de l\'utilisateur:', error)
      localStorage.removeItem('access_token')
      localStorage.removeItem('tenant_code')
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await apiService.login(credentials)

      if (response.mfa_required && response.temp_token) {
        return { mfaRequired: true, tempToken: response.temp_token }
      }

      await loadUser()
      navigate('/dashboard')
      return { mfaRequired: false }
    } catch (error: any) {
      console.error('Erreur de connexion:', error)
      throw error
    }
  }

  const verifyMFA = async (verification: MFAVerification, tempToken: string) => {
    try {
      await apiService.verifyMFA(verification, tempToken)
      await loadUser()
      navigate('/dashboard')
    } catch (error: any) {
      console.error('Erreur de vérification MFA:', error)
      throw error
    }
  }

  const logout = () => {
    apiService.logout()
    setUser(null)
    navigate('/login')
  }

  const hasPermission = (permission: string): boolean => {
    if (!user) return false

    // Mapping des permissions par rôle
    const rolePermissions: Record<string, string[]> = {
      super_admin: ['*'], // Toutes les permissions
      country_admin: [
        'users:read',
        'users:update',
        'accounts:read',
        'transactions:read',
        'kyc:approve',
        'kyc:reject',
        'reports:generate',
        'tontines:read',
      ],
      support_l1: [
        'users:read',
        'accounts:read',
        'transactions:read',
        'tickets:update',
      ],
      support_l2: [
        'users:read',
        'accounts:read',
        'accounts:freeze',
        'accounts:unfreeze',
        'transactions:read',
        'transactions:refund',
        'tickets:update',
      ],
    }

    const userPermissions = rolePermissions[user.role] || []

    // Super admin a toutes les permissions
    if (userPermissions.includes('*')) return true

    // Vérifier si la permission spécifique existe
    return userPermissions.includes(permission)
  }

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    verifyMFA,
    logout,
    hasPermission,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider')
  }
  return context
}

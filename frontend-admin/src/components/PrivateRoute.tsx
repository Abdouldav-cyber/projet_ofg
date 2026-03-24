import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '@/contexts/AuthContext'

interface PrivateRouteProps {
  children: ReactNode
  requiredPermission?: string
}

export default function PrivateRoute({ children, requiredPermission }: PrivateRouteProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth()

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Box p={3}>
        <h1>Accès refusé</h1>
        <p>Vous n'avez pas la permission d'accéder à cette page.</p>
      </Box>
    )
  }

  return <>{children}</>
}

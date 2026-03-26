import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  tenant_code: z.string().min(2, 'Code pays requis (ex: SN, CI)'),
})

type LoginFormData = z.infer<typeof loginSchema>

const mfaSchema = z.object({
  code: z.string().length(6, 'Le code MFA doit contenir 6 chiffres'),
})

type MFAFormData = z.infer<typeof mfaSchema>

export default function LoginPage() {
  const { t } = useTranslation()
  const { login, verifyMFA } = useAuth()
  const [error, setError] = useState<string>('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [tempToken, setTempToken] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const {
    register: registerLogin,
    handleSubmit: handleSubmitLogin,
    formState: { errors: loginErrors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      tenant_code: 'SN',
    },
  })

  const {
    register: registerMFA,
    handleSubmit: handleSubmitMFA,
    formState: { errors: mfaErrors },
  } = useForm<MFAFormData>({
    resolver: zodResolver(mfaSchema),
  })

  const onSubmitLogin = async (data: LoginFormData) => {
    setError('')
    setIsLoading(true)

    try {
      const result = await login(data)

      if (result.mfaRequired && result.tempToken) {
        setMfaRequired(true)
        setTempToken(result.tempToken)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur de connexion')
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmitMFA = async (data: MFAFormData) => {
    setError('')
    setIsLoading(true)

    try {
      await verifyMFA(data, tempToken)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Code MFA invalide')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6', // Gris très léger
        padding: 2,
      }}
    >
      <Card 
        elevation={0}
        sx={{ 
          maxWidth: 400, 
          width: '100%', 
          borderRadius: 2, 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Ombre subtile propre
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h5" component="h1" gutterBottom fontWeight={700} color="text.primary">
              Djembé Bank
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mfaRequired ? t('auth.mfaRequired') : 'Administration Portal'}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {!mfaRequired ? (
            <form onSubmit={handleSubmitLogin(onSubmitLogin)}>
              <TextField
                fullWidth
                label={t('auth.email')}
                type="email"
                margin="normal"
                variant="outlined"
                {...registerLogin('email')}
                error={!!loginErrors.email}
                helperText={loginErrors.email?.message}
                InputProps={{ sx: { bgcolor: 'white' } }}
              />

              <TextField
                fullWidth
                label={t('auth.password')}
                type="password"
                margin="normal"
                variant="outlined"
                {...registerLogin('password')}
                error={!!loginErrors.password}
                helperText={loginErrors.password?.message}
                InputProps={{ sx: { bgcolor: 'white' } }}
              />

              <TextField
                fullWidth
                label={t('auth.tenantCode')}
                margin="normal"
                variant="outlined"
                placeholder="SN, CI, GH, NG..."
                {...registerLogin('tenant_code')}
                error={!!loginErrors.tenant_code}
                helperText={loginErrors.tenant_code?.message}
                InputProps={{ sx: { bgcolor: 'white' } }}
              />

              <Button
                fullWidth
                variant="contained"
                color="primary" // Couleur simple standard MUI
                size="large"
                type="submit"
                disabled={isLoading}
                disableElevation
                sx={{ 
                  mt: 3, 
                  mb: 2, 
                  py: 1.5,
                  fontWeight: 'bold',
                }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : t('auth.loginButton')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmitMFA(onSubmitMFA)}>
              <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }}>
                Veuillez saisir le code à 6 chiffres de votre application.
              </Typography>

              <TextField
                fullWidth
                label="Code Sécurité MFA"
                margin="normal"
                variant="outlined"
                placeholder="000000"
                inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: '0.2em' } }}
                {...registerMFA('code')}
                error={!!mfaErrors.code}
                helperText={mfaErrors.code?.message}
                InputProps={{ sx: { bgcolor: 'white' } }}
              />

              <Button
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                type="submit"
                disabled={isLoading}
                disableElevation
                sx={{ 
                  mt: 3, 
                  mb: 1, 
                  py: 1.5,
                  fontWeight: 'bold',
                }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Vérifier'}
              </Button>

              <Button
                fullWidth
                variant="text"
                color="inherit"
                onClick={() => {
                  setMfaRequired(false)
                  setTempToken('')
                }}
              >
                Annuler
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

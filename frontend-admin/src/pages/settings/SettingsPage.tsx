import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Divider,
  Avatar,
  IconButton,
} from '@mui/material'
import {
  Save,
  PhotoCamera,
  Notifications,
  Security,
} from '@mui/icons-material'
import { useMutation } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useAuth } from '@/contexts/AuthContext'
import apiService from '@/services/api'

export default function SettingsPage() {
  const { user } = useAuth()
  const { enqueueSnackbar } = useSnackbar()

  // Paramètres de profil
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')

  // Paramètres de notifications
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)

  // Paramètres de sécurité
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mfaEnabled, setMfaEnabled] = useState(false)

  // Paramètres d'affichage


  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      return await apiService.updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone: phone,
      })
    },
    onSuccess: () => {
      enqueueSnackbar('Profil mis à jour avec succès', { variant: 'success' })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la mise à jour', { variant: 'error' })
    },
  })

  const updatePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas')
      }
      return await apiService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
    },
    onSuccess: () => {
      enqueueSnackbar('Mot de passe modifié avec succès', { variant: 'success' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || error.message || 'Erreur lors du changement de mot de passe', {
        variant: 'error',
      })
    },
  })

  const updateNotificationsMutation = useMutation({
    mutationFn: async () => {
      // Les notifications seront gerees cote backend dans une prochaine version
      await new Promise((resolve) => setTimeout(resolve, 500))
      return { success: true }
    },
    onSuccess: () => {
      enqueueSnackbar('Préférences de notifications mises à jour', { variant: 'success' })
    },
  })

  return (
    <Box sx={{ width: '100%' }}>
      <Box mb={3}>
        <Typography variant="h3">
          Parametres
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
          Configurez votre profil et vos preferences
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Profil */}
        <Grid item xs={12} lg={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    background: '#FFFFFF',
                    border: '2px solid #E5E7EB',
                    color: '#1F2937',
                    fontSize: 32,
                    fontWeight: 600,
                  }}
                >
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Photo de profil
                  </Typography>
                  <IconButton
                    component="label"
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        background: 'rgba(0,0,0,0.04)',
                      },
                    }}
                  >
                    <input hidden accept="image/*" type="file" />
                    <PhotoCamera />
                  </IconButton>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Prénom"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nom"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Téléphone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => updateProfileMutation.mutate()}
                    disabled={updateProfileMutation.isPending}
                    sx={{
                      color: 'text.primary',
                      borderColor: 'divider',
                      '&:hover': {
                        borderColor: 'text.secondary',
                      },
                    }}
                  >
                    {updateProfileMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>



        {/* Sécurité */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Security sx={{ color: '#6B7280' }} />
                <Typography variant="h6" sx={{ color: '#1F2937', fontWeight: 600 }}>
                  Sécurité
                </Typography>
              </Box>

              <Box display="flex" flexDirection="column" gap={2}>
                <TextField
                  fullWidth
                  label="Mot de passe actuel"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Nouveau mot de passe"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Confirmer le mot de passe"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => updatePasswordMutation.mutate()}
                  disabled={!currentPassword || !newPassword || !confirmPassword || updatePasswordMutation.isPending}
                  sx={{
                    color: 'text.primary',
                    borderColor: 'divider',
                    '&:hover': {
                      borderColor: 'text.secondary',
                    },
                  }}
                >
                  {updatePasswordMutation.isPending ? 'Changement...' : 'Changer le mot de passe'}
                </Button>

                <Divider sx={{ my: 1 }} />

                <FormControlLabel
                  control={
                    <Switch
                      checked={mfaEnabled}
                      onChange={(e) => setMfaEnabled(e.target.checked)}
                    />
                  }
                  label="Authentification à deux facteurs (MFA)"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Notifications sx={{ color: '#6B7280' }} />
                <Typography variant="h6" sx={{ color: '#1F2937', fontWeight: 600 }}>
                  Notifications
                </Typography>
              </Box>

              <Box display="flex" flexDirection="column" gap={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                    />
                  }
                  label="Notifications par email"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={smsNotifications}
                      onChange={(e) => setSmsNotifications(e.target.checked)}
                    />
                  }
                  label="Notifications par SMS"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={pushNotifications}
                      onChange={(e) => setPushNotifications(e.target.checked)}
                    />
                  }
                  label="Notifications push"
                />

                <Button
                  fullWidth
                  variant="outlined"
                  sx={{
                    mt: 2,
                    color: 'text.primary',
                    borderColor: 'divider',
                    '&:hover': {
                      borderColor: 'text.secondary',
                    },
                  }}
                  onClick={() => updateNotificationsMutation.mutate()}
                  disabled={updateNotificationsMutation.isPending}
                >
                  {updateNotificationsMutation.isPending ? 'Enregistrement...' : 'Enregistrer les préférences'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

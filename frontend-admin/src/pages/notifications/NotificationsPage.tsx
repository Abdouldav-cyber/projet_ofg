import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
} from '@mui/material'
import { Send, Campaign } from '@mui/icons-material'
import { useMutation } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'

export default function NotificationsPage() {
  const { enqueueSnackbar } = useSnackbar()

  // Notification individuelle
  const [userId, setUserId] = useState('')
  const [channel, setChannel] = useState('email')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  // Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('')

  const sendMutation = useMutation({
    mutationFn: () => apiService.sendNotification(userId, channel, message, subject || undefined),
    onSuccess: () => {
      enqueueSnackbar('Notification envoyee avec succes', { variant: 'success' })
      setUserId('')
      setSubject('')
      setMessage('')
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de l\'envoi', { variant: 'error' })
    },
  })

  const broadcastMutation = useMutation({
    mutationFn: () => apiService.broadcastNotification(broadcastMessage),
    onSuccess: () => {
      enqueueSnackbar('Broadcast envoye a tous les utilisateurs connectes', { variant: 'success' })
      setBroadcastMessage('')
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors du broadcast', { variant: 'error' })
    },
  })

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h3">Notifications</Typography>
        <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
          Envoyez des notifications aux utilisateurs
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Notification individuelle */}
        <Grid item xs={12} lg={7}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <Send sx={{ color: '#3B82F6' }} />
                <Typography variant="h6" fontWeight={600} sx={{ color: '#1E293B' }}>
                  Envoyer a un utilisateur
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="ID Utilisateur"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="UUID de l'utilisateur"
                    helperText="Copiez l'ID depuis la page Utilisateurs"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Canal</InputLabel>
                    <Select
                      value={channel}
                      label="Canal"
                      onChange={(e) => setChannel(e.target.value)}
                    >
                      <MenuItem value="email">Email</MenuItem>
                      <MenuItem value="sms">SMS</MenuItem>
                      <MenuItem value="push">Push (WebSocket)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Sujet (email uniquement)"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={channel !== 'email'}
                    placeholder="Objet du mail"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Contenu de la notification..."
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Send />}
                    onClick={() => sendMutation.mutate()}
                    disabled={!userId || !message || sendMutation.isPending}
                    sx={{
                      bgcolor: '#7C3AED',
                      '&:hover': { bgcolor: '#6D28D9' },
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.5,
                    }}
                  >
                    {sendMutation.isPending ? 'Envoi...' : 'Envoyer la notification'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Broadcast */}
        <Grid item xs={12} lg={5}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <Campaign sx={{ color: '#EF4444' }} />
                <Typography variant="h6" fontWeight={600} sx={{ color: '#1E293B' }}>
                  Broadcast (tous les connectes)
                </Typography>
              </Box>

              <Alert severity="warning" sx={{ mb: 2 }}>
                Ce message sera envoye a TOUS les utilisateurs actuellement connectes via WebSocket.
              </Alert>

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Message de broadcast"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Message urgent pour tous les utilisateurs..."
                sx={{ mb: 2 }}
              />

              <Button
                fullWidth
                variant="contained"
                startIcon={<Campaign />}
                onClick={() => broadcastMutation.mutate()}
                disabled={!broadcastMessage || broadcastMutation.isPending}
                sx={{
                  bgcolor: '#EF4444',
                  '&:hover': { bgcolor: '#DC2626' },
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1.5,
                }}
              >
                {broadcastMutation.isPending ? 'Diffusion...' : 'Diffuser a tous'}
              </Button>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#1E293B', mb: 1 }}>
                Test rapide
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                Testez l'envoi d'email ou SMS vers une adresse specifique.
              </Typography>

              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const email = prompt('Email de test:')
                    if (email) {
                      apiService.sendNotification(email, 'email', 'Test Djembe Bank', 'Test Notification')
                        .then(() => enqueueSnackbar('Email de test envoye', { variant: 'success' }))
                        .catch(() => enqueueSnackbar('Erreur envoi email', { variant: 'error' }))
                    }
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  Test Email
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const phone = prompt('Numero de telephone (+221...)::')
                    if (phone) {
                      apiService.sendNotification(phone, 'sms', 'Test Djembe Bank')
                        .then(() => enqueueSnackbar('SMS de test envoye', { variant: 'success' }))
                        .catch(() => enqueueSnackbar('Erreur envoi SMS', { variant: 'error' }))
                    }
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  Test SMS
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

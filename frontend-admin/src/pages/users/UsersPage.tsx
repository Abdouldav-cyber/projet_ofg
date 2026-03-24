import { useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  InputAdornment,
} from '@mui/material'
import {
  Search,
  Refresh,
  PersonAdd,
  Visibility,
  Block,
  CheckCircle,
  VisibilityOff,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { User, UserRole, KYCStatus } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'

export default function UsersPage() {
  const { hasPermission } = useAuth()
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [kycFilter, setKycFilter] = useState<KYCStatus | 'all'>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'customer' as UserRole,
  })
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    action: () => void
  }>({
    open: false,
    title: '',
    message: '',
    action: () => {},
  })

  const debouncedSearch = useDebounce(search, 500)

  // Requête pour récupérer les utilisateurs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, pageSize, debouncedSearch, roleFilter, kycFilter],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        page_size: pageSize,
      }

      if (debouncedSearch) {
        params.search = debouncedSearch
      }
      if (roleFilter !== 'all') {
        params.role = roleFilter
      }
      if (kycFilter !== 'all') {
        params.kyc_status = kycFilter
      }

      return apiService.getUsers(params)
    },
  })

  // Mutation pour créer un utilisateur
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiService.createUser(data),
    onSuccess: () => {
      enqueueSnackbar('Utilisateur créé avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateDialogOpen(false)
      setFormData({ email: '', password: '', first_name: '', last_name: '', phone: '', role: 'customer' })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la création', {
        variant: 'error',
      })
    },
  })

  // Mutation pour activer un utilisateur
  const activateMutation = useMutation({
    mutationFn: (userId: string) => apiService.activateUser(userId),
    onSuccess: () => {
      enqueueSnackbar('Utilisateur activé avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de l\'activation', {
        variant: 'error',
      })
    },
  })

  // Mutation pour désactiver un utilisateur
  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => apiService.deactivateUser(userId),
    onSuccess: () => {
      enqueueSnackbar('Utilisateur désactivé avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la désactivation', {
        variant: 'error',
      })
    },
  })

  const handleActivate = (user: User) => {
    setConfirmDialog({
      open: true,
      title: 'Activer l\'utilisateur',
      message: `Êtes-vous sûr de vouloir activer l'utilisateur ${user.first_name} ${user.last_name} ?`,
      action: () => {
        activateMutation.mutate(user.id)
        setConfirmDialog({ ...confirmDialog, open: false })
      },
    })
  }

  const handleDeactivate = (user: User) => {
    setConfirmDialog({
      open: true,
      title: 'Désactiver l\'utilisateur',
      message: `Êtes-vous sûr de vouloir désactiver l'utilisateur ${user.first_name} ${user.last_name} ?`,
      action: () => {
        deactivateMutation.mutate(user.id)
        setConfirmDialog({ ...confirmDialog, open: false })
      },
    })
  }

  const handleViewDetails = (user: User) => {
    setSelectedUser(user)
    setDetailsOpen(true)
  }

  const handleCreateUser = () => {
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      enqueueSnackbar('Veuillez remplir tous les champs obligatoires', { variant: 'warning' })
      return
    }
    createMutation.mutate(formData)
  }

  const columns: Column<User>[] = [
    {
      id: 'name',
      label: 'Nom complet',
      sortable: true,
      render: (user) => `${user.first_name} ${user.last_name}`,
    },
    {
      id: 'email',
      label: 'Email',
      sortable: true,
    },
    {
      id: 'phone',
      label: 'Téléphone',
      render: (user) => user.phone || '-',
    },
    {
      id: 'role',
      label: 'Rôle',
      render: (user) => (
        <Chip
          label={user.role.replace('_', ' ').toUpperCase()}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
    },
    {
      id: 'kyc_status',
      label: 'Statut KYC',
      render: (user) => <StatusChip status={user.kyc_status} />,
    },
    {
      id: 'is_active',
      label: 'Statut',
      render: (user) => <StatusChip status={user.is_active ? 'active' : 'inactive'} />,
    },
    {
      id: 'created_at',
      label: 'Date de création',
      sortable: true,
      render: (user) => format(new Date(user.created_at), 'dd/MM/yyyy HH:mm'),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (user) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Tooltip title="Voir détails">
            <IconButton size="small" onClick={() => handleViewDetails(user)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>

          {hasPermission('users:update') && (
            <>
              {user.is_active ? (
                <Tooltip title="Désactiver">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeactivate(user)}
                  >
                    <Block fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Activer">
                  <IconButton
                    size="small"
                    color="success"
                    onClick={() => handleActivate(user)}
                  >
                    <CheckCircle fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h3">
            Gestion des utilisateurs
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
            Gerez les comptes utilisateurs et leurs permissions
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PersonAdd />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={!hasPermission('users:create')}
        >
          Nouvel utilisateur
        </Button>
      </Box>

      {/* Filtres */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          backgroundColor: '#FFFFFF',
          borderRadius: 3,
          border: '1px solid #E2E8F0',
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <TextField
          placeholder="Rechercher par nom, email..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 300 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Rôle</InputLabel>
          <Select
            value={roleFilter}
            label="Rôle"
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
          >
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="customer">Client</MenuItem>
            <MenuItem value="support_l1">Support L1</MenuItem>
            <MenuItem value="support_l2">Support L2</MenuItem>
            <MenuItem value="country_admin">Country Admin</MenuItem>
            <MenuItem value="super_admin">Super Admin</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Statut KYC</InputLabel>
          <Select
            value={kycFilter}
            label="Statut KYC"
            onChange={(e) => setKycFilter(e.target.value as KYCStatus | 'all')}
          >
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="pending">En attente</MenuItem>
            <MenuItem value="approved">Approuvé</MenuItem>
            <MenuItem value="rejected">Rejeté</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="Actualiser">
          <IconButton onClick={() => refetch()}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tableau */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        totalCount={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(user) => user.id}
      />

      {/* Dialog création utilisateur */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Créer un nouvel utilisateur
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Prénom"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nom"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Téléphone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+221771234567"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Rôle"
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="customer">👤 Utilisateur</option>
                  <option value="support_l1">🎧 Support L1</option>
                  <option value="support_l2">🎧 Support L2</option>
                  <option value="country_admin">🌍 Admin Pays</option>
                  <option value="super_admin">👑 Super Admin</option>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateUser}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creation...' : 'Creer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de détails */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Détails de l'utilisateur</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Prénom
                </Typography>
                <Typography variant="body1">{selectedUser.first_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Nom
                </Typography>
                <Typography variant="body1">{selectedUser.last_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1">{selectedUser.email}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Téléphone
                </Typography>
                <Typography variant="body1">{selectedUser.phone || '-'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Rôle
                </Typography>
                <Typography variant="body1">
                  {selectedUser.role.replace('_', ' ').toUpperCase()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Statut
                </Typography>
                <Box mt={0.5}>
                  <StatusChip status={selectedUser.is_active ? 'active' : 'inactive'} />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Statut KYC
                </Typography>
                <Box mt={0.5}>
                  <StatusChip status={selectedUser.kyc_status} />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Date de création
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedUser.created_at), 'dd/MM/yyyy à HH:mm')}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
        loading={activateMutation.isPending || deactivateMutation.isPending}
      />
    </Box>
  )
}

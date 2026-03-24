import { useState, useMemo } from 'react'
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
  Autocomplete,
  CircularProgress,
} from '@mui/material'
import {
  Search,
  Refresh,
  Visibility,
  AcUnit,
  CheckCircle,
  Cancel,
  Add,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Account, AccountType, AccountStatus } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'

export default function AccountsPage() {
  const { hasPermission } = useAuth()
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all')
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    action: () => void
    severity?: 'info' | 'warning' | 'error'
  }>({
    open: false,
    title: '',
    message: '',
    action: () => {},
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [newAccountType, setNewAccountType] = useState<string>('savings')
  const [newAccountCurrency, setNewAccountCurrency] = useState<string>('XOF')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [userSearch, setUserSearch] = useState('')

  const debouncedSearch = useDebounce(search, 500)
  const debouncedUserSearch = useDebounce(userSearch, 400)

  // Requete pour chercher des utilisateurs (pour la creation de compte)
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users-search', debouncedUserSearch],
    queryFn: () => apiService.getUsers({ page: 1, page_size: 20, search: debouncedUserSearch || undefined }),
    enabled: createOpen,
  })

  const userOptions = useMemo(() => {
    const items = usersData?.items || []
    return items.map((u: any) => ({
      id: u.id,
      label: `${u.first_name || ''} ${u.last_name || ''} (${u.email})`.trim(),
    }))
  }, [usersData])

  // Mutation pour créer un compte
  const createMutation = useMutation({
    mutationFn: () => apiService.createAccount({
      user_id: selectedUserId,
      account_type: newAccountType,
      initial_currency: newAccountCurrency,
    }),
    onSuccess: () => {
      enqueueSnackbar('Compte cree avec succes', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setCreateOpen(false)
      setNewAccountType('savings')
      setNewAccountCurrency('XOF')
      setSelectedUserId('')
      setUserSearch('')
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la creation', { variant: 'error' })
    },
  })

  // Requête pour récupérer les comptes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accounts', page, pageSize, debouncedSearch, typeFilter, statusFilter],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        page_size: pageSize,
      }

      if (debouncedSearch) {
        params.search = debouncedSearch
      }
      if (typeFilter !== 'all') {
        params.account_type = typeFilter
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      return apiService.getAccounts(params)
    },
  })

  // Mutation pour geler un compte
  const freezeMutation = useMutation({
    mutationFn: (accountId: string) => apiService.freezeAccount(accountId, 'Gel administratif'),
    onSuccess: () => {
      enqueueSnackbar('Compte gelé avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors du gel', {
        variant: 'error',
      })
    },
  })

  // Mutation pour dégeler un compte
  const unfreezeMutation = useMutation({
    mutationFn: (accountId: string) => apiService.unfreezeAccount(accountId),
    onSuccess: () => {
      enqueueSnackbar('Compte dégelé avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors du dégel', {
        variant: 'error',
      })
    },
  })

  // Mutation pour fermer un compte
  const closeMutation = useMutation({
    mutationFn: (accountId: string) => apiService.closeAccount(accountId),
    onSuccess: () => {
      enqueueSnackbar('Compte fermé avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la fermeture', {
        variant: 'error',
      })
    },
  })

  const handleFreeze = (account: Account) => {
    setConfirmDialog({
      open: true,
      title: 'Geler le compte',
      message: `Êtes-vous sûr de vouloir geler le compte ${account.account_number} ? L'utilisateur ne pourra plus effectuer de transactions.`,
      severity: 'warning',
      action: () => {
        freezeMutation.mutate(account.id)
        setConfirmDialog({ ...confirmDialog, open: false })
      },
    })
  }

  const handleUnfreeze = (account: Account) => {
    setConfirmDialog({
      open: true,
      title: 'Dégeler le compte',
      message: `Êtes-vous sûr de vouloir dégeler le compte ${account.account_number} ?`,
      action: () => {
        unfreezeMutation.mutate(account.id)
        setConfirmDialog({ ...confirmDialog, open: false })
      },
    })
  }

  const handleClose = (account: Account) => {
    setConfirmDialog({
      open: true,
      title: 'Fermer le compte',
      message: `Êtes-vous sûr de vouloir fermer définitivement le compte ${account.account_number} ? Cette action est irréversible. Le solde doit être à zéro.`,
      severity: 'error',
      action: () => {
        closeMutation.mutate(account.id)
        setConfirmDialog({ ...confirmDialog, open: false })
      },
    })
  }

  const handleViewDetails = (account: Account) => {
    setSelectedAccount(account)
    setDetailsOpen(true)
  }

  const formatCurrency = (amount: number, currency: string) => {
    return `${new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)} ${currency}`
  }

  const columns: Column<Account>[] = [
    {
      id: 'account_number',
      label: 'Numero de compte',
      sortable: true,
      render: (account) => (
        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace' }}>
          {account.account_number}
        </Typography>
      ),
    },
    {
      id: 'owner_name' as any,
      label: 'Proprietaire',
      minWidth: 160,
      render: (account: any) => (
        <Typography variant="body2">
          {account.owner_name || '-'}
        </Typography>
      ),
    },
    {
      id: 'account_type',
      label: 'Type',
      render: (account) => (
        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
          {account.account_type === 'savings' ? 'Epargne' :
           account.account_type === 'checking' ? 'Courant' : 'Tontine'}
        </Typography>
      ),
    },
    {
      id: 'balance',
      label: 'Solde',
      sortable: true,
      align: 'right',
      render: (account) => (
        <Typography
          variant="body2"
          fontWeight={600}
          color={account.balance >= 0 ? 'success.main' : 'error.main'}
        >
          {formatCurrency(account.balance, account.currency)}
        </Typography>
      ),
    },
    {
      id: 'currency',
      label: 'Devise',
    },
    {
      id: 'status',
      label: 'Statut',
      render: (account) => <StatusChip status={account.status} />,
    },
    {
      id: 'created_at',
      label: 'Date de création',
      sortable: true,
      render: (account) => format(new Date(account.created_at), 'dd/MM/yyyy'),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (account) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Tooltip title="Voir détails">
            <IconButton size="small" onClick={() => handleViewDetails(account)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>

          {hasPermission('accounts:freeze') && account.status === 'active' && (
            <Tooltip title="Geler">
              <IconButton
                size="small"
                color="warning"
                onClick={() => handleFreeze(account)}
              >
                <AcUnit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {hasPermission('accounts:unfreeze') && account.status === 'frozen' && (
            <Tooltip title="Dégeler">
              <IconButton
                size="small"
                color="success"
                onClick={() => handleUnfreeze(account)}
              >
                <CheckCircle fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {hasPermission('accounts:close') && account.status !== 'closed' && (
            <Tooltip title="Fermer">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleClose(account)}
              >
                <Cancel fontSize="small" />
              </IconButton>
            </Tooltip>
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
            Gestion des comptes
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
            Consultez et gerez les comptes bancaires
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateOpen(true)}
          sx={{
            bgcolor: '#7C3AED',
            '&:hover': { bgcolor: '#6D28D9' },
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 2,
          }}
        >
          Creer un compte
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
          placeholder="Rechercher par numéro de compte..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 300 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type de compte</InputLabel>
          <Select
            value={typeFilter}
            label="Type de compte"
            onChange={(e) => setTypeFilter(e.target.value as AccountType | 'all')}
          >
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="savings">Épargne</MenuItem>
            <MenuItem value="checking">Courant</MenuItem>
            <MenuItem value="tontine">Tontine</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Statut</InputLabel>
          <Select
            value={statusFilter}
            label="Statut"
            onChange={(e) => setStatusFilter(e.target.value as AccountStatus | 'all')}
          >
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="active">Actif</MenuItem>
            <MenuItem value="frozen">Gelé</MenuItem>
            <MenuItem value="closed">Fermé</MenuItem>
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
        rowKey={(account) => account.id}
      />

      {/* Dialog de détails */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Détails du compte</DialogTitle>
        <DialogContent>
          {selectedAccount && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Numéro de compte
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {selectedAccount.account_number}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Type de compte
                </Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {selectedAccount.account_type === 'savings' ? 'Épargne' :
                   selectedAccount.account_type === 'checking' ? 'Courant' : 'Tontine'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Solde actuel
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={600}
                  color={selectedAccount.balance >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(selectedAccount.balance, selectedAccount.currency)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Devise
                </Typography>
                <Typography variant="body1">{selectedAccount.currency}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Statut
                </Typography>
                <Box mt={0.5}>
                  <StatusChip status={selectedAccount.status} />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Date de création
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedAccount.created_at), 'dd/MM/yyyy à HH:mm')}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  ID Utilisateur
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {selectedAccount.user_id}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de creation de compte */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Creer un nouveau compte</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={userOptions}
                getOptionLabel={(option: any) => option.label}
                loading={usersLoading}
                onInputChange={(_e, value) => setUserSearch(value)}
                onChange={(_e, value: any) => setSelectedUserId(value?.id || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Utilisateur *"
                    placeholder="Rechercher par nom ou email..."
                    helperText="Selectionnez l'utilisateur proprietaire du compte"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {usersLoading ? <CircularProgress size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                noOptionsText="Aucun utilisateur trouve"
                loadingText="Recherche..."
                isOptionEqualToValue={(option: any, value: any) => option.id === value.id}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Type de compte</InputLabel>
                <Select
                  value={newAccountType}
                  label="Type de compte"
                  onChange={(e) => setNewAccountType(e.target.value)}
                >
                  <MenuItem value="savings">Epargne</MenuItem>
                  <MenuItem value="checking">Courant</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Devise</InputLabel>
                <Select
                  value={newAccountCurrency}
                  label="Devise"
                  onChange={(e) => setNewAccountCurrency(e.target.value)}
                >
                  <MenuItem value="XOF">XOF (Franc CFA)</MenuItem>
                  <MenuItem value="EUR">EUR (Euro)</MenuItem>
                  <MenuItem value="USD">USD (Dollar US)</MenuItem>
                  <MenuItem value="NGN">NGN (Naira)</MenuItem>
                  <MenuItem value="GHS">GHS (Cedi)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !selectedUserId}
            sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
          >
            {createMutation.isPending ? 'Creation...' : 'Creer le compte'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        severity={confirmDialog.severity}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
        loading={
          freezeMutation.isPending ||
          unfreezeMutation.isPending ||
          closeMutation.isPending
        }
      />
    </Box>
  )
}

import { useState } from 'react'
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card as MuiCard,
  CardContent,
} from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { format } from 'date-fns'
import { Block, CreditCard, Add, CheckCircle, Delete } from '@mui/icons-material'
import { IconButton, Tooltip, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, CircularProgress, Grid } from '@mui/material'

export default function CardsPage() {
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'locked' | 'expired'>('all')
  
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

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false)
  const [newCardType, setNewCardType] = useState<string>('virtual')
  const [accountSearch, setAccountSearch] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')

  // Queries
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts-search', accountSearch],
    queryFn: () => apiService.getAccounts({ page: 1, page_size: 20, search: accountSearch || undefined }),
    enabled: createOpen,
  })

  // Queries
  const { data: cardsData, isLoading } = useQuery({
    queryKey: ['cards', page, pageSize, statusFilter],
    queryFn: () => apiService.getAdminCards({
      page: page + 1,
      page_size: pageSize,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => apiService.createAdminCard(selectedAccountId, newCardType),
    onSuccess: () => {
      enqueueSnackbar('Carte créée avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      setCreateOpen(false)
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la création de la carte', { variant: 'error' })
    }
  })

  const freezeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => apiService.freezeAdminCard(id, reason),
    onSuccess: () => {
      enqueueSnackbar('Carte bloquée avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors du blocage', { variant: 'error' })
    }
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => apiService.activateAdminCard(id),
    onSuccess: () => {
      enqueueSnackbar('Carte activée avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de l\'activation', { variant: 'error' })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteAdminCard(id),
    onSuccess: () => {
      enqueueSnackbar('Carte supprimée avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la suppression', { variant: 'error' })
    }
  })

  const handleActivate = (card: any) => {
    setConfirmDialog({
      open: true,
      title: 'Activer la Carte Bancaire',
      message: `Êtes-vous sûr de vouloir activer définitivement la carte se terminant par ${card.last_4_digits} ?`,
      severity: 'info',
      action: () => {
        activateMutation.mutate(card.id)
      }
    })
  }

  const handleDelete = (card: any) => {
    setConfirmDialog({
      open: true,
      title: 'Supprimer la Carte Bancaire',
      message: `Supprimer de la base de données la carte se terminant par ${card.last_4_digits} ?`,
      severity: 'error',
      action: () => {
        deleteMutation.mutate(card.id)
      }
    })
  }

  const handleFreeze = (card: any) => {
    setConfirmDialog({
      open: true,
      title: 'Bloquer la Carte Bancaire',
      message: `Êtes-vous sûr de vouloir bloquer la carte se terminant par ${card.last_4_digits} ? Cette action est irréversible et forcera le client à en émettre une nouvelle.`,
      severity: 'error',
      action: () => {
        freezeMutation.mutate({ id: card.id, reason: "Bloquée par l'administrateur" })
      }
    })
  }

  const columns: Column<any>[] = [
    {
      id: 'last_4_digits',
      label: 'Numéro',
      render: (row: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CreditCard fontSize="small" sx={{ color: 'text.secondary' }} />
          **** **** **** {row.last_4_digits}
        </Box>
      )
    },
    { 
      id: 'card_type', 
      label: 'Type',
      render: (row: any) => row.card_type === 'virtual' ? 'Virtuelle' : 'Physique'
    },
    {
      id: 'expiry_date',
      label: 'Expiration',
      render: (row: any) => format(new Date(row.expiry_date), 'MM/yyyy')
    },
    {
      id: 'status',
      label: 'Statut',
      render: (row: any) => <StatusChip status={row.status as any} />
    },
    {
      id: 'monthly_limit',
      label: 'Plafond (Mois)',
      render: (row: any) => `${Number(row.monthly_limit).toLocaleString()} XOF`
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'center',
      render: (row: any) => (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
          {row.status === 'pending' && (
             <Tooltip title="Activer la carte">
              <IconButton size="small" color="success" onClick={() => handleActivate(row)}>
                <CheckCircle fontSize="small" />
              </IconButton>
             </Tooltip>
          )}

          {row.status !== 'locked' && row.status !== 'expired' && row.status !== 'pending' && (
             <Tooltip title="Bloquer (Geler)">
              <IconButton size="small" color="warning" onClick={() => handleFreeze(row)}>
                <Block fontSize="small" />
              </IconButton>
             </Tooltip>
          )}

          <Tooltip title="Supprimer la carte">
            <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ]

  const items = Array.isArray(cardsData) ? cardsData : (cardsData?.items || [])
  const total = cardsData?.total || items.length

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Cartes Bancaires
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)} sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}>
          Créer une carte
        </Button>
      </Box>

      <MuiCard sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Statut</InputLabel>
            <Select
              value={statusFilter}
              label="Statut"
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <MenuItem value="all">Tous</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">En attente</MenuItem>
              <MenuItem value="locked">Bloquée</MenuItem>
              <MenuItem value="expired">Expirée</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </MuiCard>

      <DataTable
        columns={columns}
        data={items}
        totalCount={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={isLoading || freezeMutation.isPending}
        rowKey={(row) => row.id}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        severity={confirmDialog.severity}
        onConfirm={() => {
          confirmDialog.action()
          setConfirmDialog(prev => ({ ...prev, open: false }))
        }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Émettre une nouvelle carte bancaire</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Autocomplete
                options={Array.isArray(accountsData?.items) ? accountsData.items.map((a: any) => ({
                    id: a.id, 
                    label: `${a.account_type.toUpperCase()} - ${a.iban || 'Sans IBAN'} (User: ${a.user_id.slice(0, 8)}...)` 
                })) : []}
                loading={accountsLoading}
                onInputChange={(_, newInputValue) => setAccountSearch(newInputValue)}
                onChange={(_, newValue: any) => setSelectedAccountId(newValue?.id || '')}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Rechercher le compte bancaire associé (ex: IBAN)" 
                    variant="outlined" 
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {accountsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Type de Carte</InputLabel>
                <Select
                  value={newCardType}
                  label="Type de Carte"
                  onChange={(e) => setNewCardType(e.target.value)}
                >
                  <MenuItem value="virtual">Virtuelle</MenuItem>
                  <MenuItem value="physical">Physique</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)} color="inherit">Annuler</Button>
          <Button 
            onClick={() => createMutation.mutate()} 
            variant="contained" 
            color="primary"
            disabled={!selectedAccountId || createMutation.isPending}
          >
            {createMutation.isPending ? 'Création...' : 'Créer et Assigner'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

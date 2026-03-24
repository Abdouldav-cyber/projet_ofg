import { useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Button,
  Chip,
} from '@mui/material'
import {
  Search,
  Refresh,
  Visibility,
  Undo,
  FilterList,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Transaction, TransactionType, TransactionStatus } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'

export default function TransactionsPage() {
  const { hasPermission } = useAuth()
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundDialog, setRefundDialog] = useState(false)
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

  // Requête pour récupérer les transactions
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', page, pageSize, debouncedSearch, typeFilter, statusFilter],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        page_size: pageSize,
      }

      if (debouncedSearch) {
        params.search = debouncedSearch
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      return apiService.getTransactions(params)
    },
  })

  // Mutation pour rembourser une transaction
  const refundMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiService.refundTransaction(id, reason),
    onSuccess: () => {
      enqueueSnackbar('Transaction remboursée avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setRefundDialog(false)
      setRefundReason('')
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.detail || 'Erreur lors du remboursement',
        { variant: 'error' }
      )
    },
  })

  const handleRefund = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setRefundDialog(true)
  }

  const confirmRefund = () => {
    if (!selectedTransaction) return

    if (!refundReason.trim()) {
      enqueueSnackbar('Veuillez indiquer une raison pour le remboursement', {
        variant: 'warning',
      })
      return
    }

    refundMutation.mutate({
      id: selectedTransaction.id,
      reason: refundReason,
    })
  }

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setDetailsOpen(true)
  }

  const formatCurrency = (amount: number, currency: string) => {
    return `${new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)} ${currency}`
  }

  const getTransactionTypeLabel = (type: TransactionType) => {
    const labels: Record<TransactionType, string> = {
      deposit: 'Dépôt',
      withdrawal: 'Retrait',
      transfer: 'Virement',
      tontine_contribution: 'Contribution Tontine',
    }
    return labels[type] || type
  }

  const columns: Column<Transaction>[] = [
    {
      id: 'reference',
      label: 'Référence',
      sortable: true,
      render: (transaction) => (
        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace' }}>
          {transaction.reference}
        </Typography>
      ),
    },
    {
      id: 'type',
      label: 'Type',
      render: (transaction) => (
        <Chip
          label={getTransactionTypeLabel(transaction.type)}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
    },
    {
      id: 'amount',
      label: 'Montant',
      sortable: true,
      align: 'right',
      render: (transaction) => (
        <Typography variant="body2" fontWeight={600}>
          {formatCurrency(transaction.amount, transaction.currency)}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Statut',
      render: (transaction) => <StatusChip status={transaction.status} />,
    },
    {
      id: 'saga_state',
      label: 'État Saga',
      render: (transaction) =>
        transaction.saga_state ? (
          <StatusChip status={transaction.saga_state} size="small" />
        ) : (
          <Typography variant="caption" color="text.secondary">
            N/A
          </Typography>
        ),
    },
    {
      id: 'fraud_score',
      label: 'Score Fraude',
      align: 'center',
      render: (transaction) => {
        if (transaction.fraud_score === undefined || transaction.fraud_score === null) {
          return <Typography variant="caption">N/A</Typography>
        }

        const score = transaction.fraud_score
        const color =
          score >= 70 ? 'error' : score >= 30 ? 'warning' : 'success'

        return (
          <Chip
            label={score.toFixed(0)}
            size="small"
            color={color}
            variant="outlined"
          />
        )
      },
    },
    {
      id: 'created_at',
      label: 'Date',
      sortable: true,
      render: (transaction) =>
        format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm'),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (transaction) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Tooltip title="Voir détails">
            <IconButton size="small" onClick={() => handleViewDetails(transaction)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>

          {hasPermission('transactions:refund') &&
            transaction.status === 'completed' &&
            transaction.type !== 'withdrawal' && (
              <Tooltip title="Rembourser">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleRefund(transaction)}
                >
                  <Undo fontSize="small" />
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
            Transactions
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
            Historique et suivi des transactions
          </Typography>
        </Box>
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
        <FilterList sx={{ color: 'text.secondary' }} />

        <TextField
          placeholder="Rechercher par référence..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 250 }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type de transaction</InputLabel>
          <Select
            value={typeFilter}
            label="Type de transaction"
            onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')}
          >
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="deposit">Dépôt</MenuItem>
            <MenuItem value="withdrawal">Retrait</MenuItem>
            <MenuItem value="transfer">Virement</MenuItem>
            <MenuItem value="tontine_contribution">Contribution Tontine</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Statut</InputLabel>
          <Select
            value={statusFilter}
            label="Statut"
            onChange={(e) =>
              setStatusFilter(e.target.value as TransactionStatus | 'all')
            }
          >
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="pending">En attente</MenuItem>
            <MenuItem value="completed">Complété</MenuItem>
            <MenuItem value="failed">Échoué</MenuItem>
            <MenuItem value="refunded">Remboursé</MenuItem>
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
        rowKey={(transaction) => transaction.id}
      />

      {/* Dialog de détails */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Détails de la transaction</DialogTitle>
        <DialogContent>
          {selectedTransaction && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Référence
                </Typography>
                <Typography
                  variant="body1"
                  fontWeight={600}
                  sx={{ fontFamily: 'monospace' }}
                >
                  {selectedTransaction.reference}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Type de transaction
                </Typography>
                <Typography variant="body1">
                  {getTransactionTypeLabel(selectedTransaction.type)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Montant
                </Typography>
                <Typography variant="h5" fontWeight={600} color="primary">
                  {formatCurrency(
                    selectedTransaction.amount,
                    selectedTransaction.currency
                  )}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Statut
                </Typography>
                <Box mt={0.5}>
                  <StatusChip status={selectedTransaction.status} />
                </Box>
              </Grid>
              {selectedTransaction.saga_state && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    État Saga
                  </Typography>
                  <Box mt={0.5}>
                    <StatusChip status={selectedTransaction.saga_state} />
                  </Box>
                </Grid>
              )}
              {selectedTransaction.fraud_score !== undefined && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Score de fraude
                  </Typography>
                  <Typography variant="body1">
                    {selectedTransaction.fraud_score.toFixed(2)} / 100
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Date de création
                </Typography>
                <Typography variant="body1">
                  {format(
                    new Date(selectedTransaction.created_at),
                    'dd/MM/yyyy à HH:mm:ss'
                  )}
                </Typography>
              </Grid>
              {selectedTransaction.completed_at && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Date de complétion
                  </Typography>
                  <Typography variant="body1">
                    {format(
                      new Date(selectedTransaction.completed_at),
                      'dd/MM/yyyy à HH:mm:ss'
                    )}
                  </Typography>
                </Grid>
              )}
              {selectedTransaction.from_account_id && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Compte source
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {selectedTransaction.from_account_id}
                  </Typography>
                </Grid>
              )}
              {selectedTransaction.to_account_id && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Compte destination
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {selectedTransaction.to_account_id}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de remboursement */}
      <Dialog
        open={refundDialog}
        onClose={() => !refundMutation.isPending && setRefundDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rembourser la transaction</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Vous êtes sur le point de rembourser la transaction{' '}
            <strong>{selectedTransaction?.reference}</strong> d'un montant de{' '}
            <strong>
              {selectedTransaction &&
                formatCurrency(
                  selectedTransaction.amount,
                  selectedTransaction.currency
                )}
            </strong>
            .
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Raison du remboursement"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Expliquez la raison du remboursement..."
            disabled={refundMutation.isPending}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRefundDialog(false)
              setRefundReason('')
            }}
            disabled={refundMutation.isPending}
          >
            Annuler
          </Button>
          <Button
            onClick={confirmRefund}
            color="error"
            variant="contained"
            disabled={refundMutation.isPending || !refundReason.trim()}
          >
            {refundMutation.isPending ? 'En cours...' : 'Confirmer le remboursement'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
      />
    </Box>
  )
}

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
  LinearProgress,
} from '@mui/material'
import {
  Search,
  Refresh,
  Visibility,
  People,
  Add,
  PlayArrow,
  SkipNext,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Tontine, TontineFrequency, TontineStatus, DistributionMethod } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { format } from 'date-fns'

export default function TontinesPage() {
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TontineStatus | 'all'>('all')
  const [selectedTontine, setSelectedTontine] = useState<Tontine | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Creation
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTargetAmount, setNewTargetAmount] = useState('')
  const [newContribution, setNewContribution] = useState('')
  const [newFrequency, setNewFrequency] = useState('monthly')
  const [newMaxMembers, setNewMaxMembers] = useState('')
  const [newDistribution, setNewDistribution] = useState('rotating')

  // Confirmation
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; action: () => void; severity?: 'info' | 'warning' | 'error'
  }>({ open: false, title: '', message: '', action: () => {} })

  const debouncedSearch = useDebounce(search, 500)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tontines', page, pageSize, debouncedSearch, statusFilter],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        page_size: pageSize,
      }

      if (debouncedSearch) {
        params.search = debouncedSearch
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      return apiService.getTontines(params)
    },
  })

  // Mutation creation
  const createMutation = useMutation({
    mutationFn: () => apiService.createTontine({
      name: newName,
      target_amount: parseFloat(newTargetAmount),
      frequency: newFrequency,
    }),
    onSuccess: () => {
      enqueueSnackbar('Tontine creee avec succes', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['tontines'] })
      setCreateOpen(false)
      setNewName(''); setNewTargetAmount(''); setNewContribution('')
      setNewFrequency('monthly'); setNewMaxMembers(''); setNewDistribution('rotating')
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la creation', { variant: 'error' })
    },
  })

  // Mutation demarrer tontine
  const startMutation = useMutation({
    mutationFn: (id: string) => apiService.startTontine(id),
    onSuccess: () => {
      enqueueSnackbar('Tontine demarree avec succes', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['tontines'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors du demarrage', { variant: 'error' })
    },
  })

  // Mutation declencher cycle
  const triggerCycleMutation = useMutation({
    mutationFn: (id: string) => apiService.triggerTontineCycle(id),
    onSuccess: () => {
      enqueueSnackbar('Cycle declenche avec succes', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['tontines'] })
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors du declenchement', { variant: 'error' })
    },
  })

  const handleStart = (tontine: Tontine) => {
    setConfirmDialog({
      open: true,
      title: 'Demarrer la tontine',
      message: `Demarrer la tontine "${tontine.name}" ? Les cycles de collecte commenceront.`,
      severity: 'info',
      action: () => { startMutation.mutate(tontine.id); setConfirmDialog(d => ({ ...d, open: false })) },
    })
  }

  const handleTriggerCycle = (tontine: Tontine) => {
    setConfirmDialog({
      open: true,
      title: 'Declencher le prochain cycle',
      message: `Declencher le cycle ${tontine.current_cycle + 1} de la tontine "${tontine.name}" ? Le beneficiaire sera selectionne et les fonds distribues.`,
      severity: 'warning',
      action: () => { triggerCycleMutation.mutate(tontine.id); setConfirmDialog(d => ({ ...d, open: false })) },
    })
  }

  const handleViewDetails = (tontine: Tontine) => {
    setSelectedTontine(tontine)
    setDetailsOpen(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' XOF'
  }

  const getFrequencyLabel = (freq: TontineFrequency) => {
    const labels: Record<TontineFrequency, string> = {
      daily: 'Quotidien',
      weekly: 'Hebdomadaire',
      monthly: 'Mensuel',
    }
    return labels[freq]
  }

  const getDistributionLabel = (method: DistributionMethod) => {
    const labels: Record<DistributionMethod, string> = {
      rotating: 'Rotation',
      random: 'Aléatoire',
      vote: 'Vote',
    }
    return labels[method]
  }

  const columns: Column<Tontine>[] = [
    {
      id: 'name',
      label: 'Nom',
      sortable: true,
      render: (tontine) => (
        <Typography variant="body2" fontWeight={500}>
          {tontine.name}
        </Typography>
      ),
    },
    {
      id: 'contribution_amount',
      label: 'Montant contribution',
      align: 'right',
      render: (tontine) => formatCurrency(tontine.contribution_amount),
    },
    {
      id: 'target_amount',
      label: 'Montant cible',
      align: 'right',
      render: (tontine) => formatCurrency(tontine.target_amount),
    },
    {
      id: 'frequency',
      label: 'Fréquence',
      render: (tontine) => (
        <Chip label={getFrequencyLabel(tontine.frequency)} size="small" />
      ),
    },
    {
      id: 'members',
      label: 'Membres',
      align: 'center',
      render: (tontine) => (
        <Box display="flex" alignItems="center" gap={0.5} justifyContent="center">
          <People fontSize="small" color="action" />
          <Typography variant="body2">
            {tontine.current_members}/{tontine.max_members}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'current_cycle',
      label: 'Cycle',
      align: 'center',
      render: (tontine) => (
        <Chip label={`Cycle ${tontine.current_cycle}`} size="small" color="info" />
      ),
    },
    {
      id: 'status',
      label: 'Statut',
      render: (tontine) => <StatusChip status={tontine.status} />,
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (tontine) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <Tooltip title="Voir details">
            <IconButton size="small" onClick={() => handleViewDetails(tontine)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          {tontine.status !== 'active' && tontine.status !== 'completed' && (
            <Tooltip title="Demarrer">
              <IconButton size="small" color="success" onClick={() => handleStart(tontine)}>
                <PlayArrow fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {tontine.status === 'active' && (
            <Tooltip title="Declencher cycle">
              <IconButton size="small" color="info" onClick={() => handleTriggerCycle(tontine)}>
                <SkipNext fontSize="small" />
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
            Gestion des tontines
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
            Suivez les groupes de tontines et leurs cycles
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
          Creer une tontine
        </Button>
      </Box>

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
          placeholder="Rechercher une tontine..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 300 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Statut</InputLabel>
          <Select
            value={statusFilter}
            label="Statut"
            onChange={(e) => setStatusFilter(e.target.value as TontineStatus | 'all')}
          >
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="active">Actif</MenuItem>
            <MenuItem value="completed">Complété</MenuItem>
            <MenuItem value="cancelled">Annulé</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="Actualiser">
          <IconButton onClick={() => refetch()}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        totalCount={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(tontine) => tontine.id}
      />

      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Détails de la tontine</DialogTitle>
        <DialogContent>
          {selectedTontine && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6">{selectedTontine.name}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Montant de contribution
                </Typography>
                <Typography variant="h5" color="primary" fontWeight={600}>
                  {formatCurrency(selectedTontine.contribution_amount)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Montant cible
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  {formatCurrency(selectedTontine.target_amount)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Fréquence
                </Typography>
                <Typography variant="body1">
                  {getFrequencyLabel(selectedTontine.frequency)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Méthode de distribution
                </Typography>
                <Typography variant="body1">
                  {getDistributionLabel(selectedTontine.distribution_method)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Cycle actuel
                </Typography>
                <Typography variant="body1">
                  Cycle {selectedTontine.current_cycle}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Statut
                </Typography>
                <Box mt={0.5}>
                  <StatusChip status={selectedTontine.status} />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Progression des membres
                </Typography>
                <Box display="flex" alignItems="center" gap={1} mt={1}>
                  <LinearProgress
                    variant="determinate"
                    value={
                      (selectedTontine.current_members /
                        selectedTontine.max_members) *
                      100
                    }
                    sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2">
                    {selectedTontine.current_members}/{selectedTontine.max_members}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Date de création
                </Typography>
                <Typography variant="body1">
                  {format(
                    new Date(selectedTontine.created_at),
                    'dd/MM/yyyy à HH:mm'
                  )}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog creation tontine */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Creer une nouvelle tontine</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nom de la tontine"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Tontine Epargne Dakar"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Montant cible (XOF)"
                type="number"
                value={newTargetAmount}
                onChange={(e) => setNewTargetAmount(e.target.value)}
                placeholder="Ex: 500000"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contribution par membre (XOF)"
                type="number"
                value={newContribution}
                onChange={(e) => setNewContribution(e.target.value)}
                placeholder="Ex: 25000"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Frequence</InputLabel>
                <Select
                  value={newFrequency}
                  label="Frequence"
                  onChange={(e) => setNewFrequency(e.target.value)}
                >
                  <MenuItem value="daily">Quotidien</MenuItem>
                  <MenuItem value="weekly">Hebdomadaire</MenuItem>
                  <MenuItem value="monthly">Mensuel</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombre max de membres"
                type="number"
                value={newMaxMembers}
                onChange={(e) => setNewMaxMembers(e.target.value)}
                placeholder="Ex: 10"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Methode de distribution</InputLabel>
                <Select
                  value={newDistribution}
                  label="Methode de distribution"
                  onChange={(e) => setNewDistribution(e.target.value)}
                >
                  <MenuItem value="rotating">Rotation (tour a tour)</MenuItem>
                  <MenuItem value="random">Aleatoire</MenuItem>
                  <MenuItem value="vote">Vote des membres</MenuItem>
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
            disabled={!newName || !newTargetAmount || createMutation.isPending}
            sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
          >
            {createMutation.isPending ? 'Creation...' : 'Creer la tontine'}
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
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
        loading={startMutation.isPending || triggerCycleMutation.isPending}
      />
    </Box>
  )
}

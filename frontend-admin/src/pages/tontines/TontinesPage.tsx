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
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import {
  Search,
  Refresh,
  Visibility,
  People,
  Add,
  PlayArrow,
  SkipNext,
  PersonAdd,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Tontine, TontineStatus } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { format } from 'date-fns'

interface TontineMember {
  id: string
  tontine_id: string
  user_id: string
  user_name: string
  user_email?: string
  contribution_amount: number
  order: number
  joined_at: string
}

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

  // Members management
  const [membersOpen, setMembersOpen] = useState(false)
  const [membersTontine, setMembersTontine] = useState<Tontine | null>(null)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [memberContribution, setMemberContribution] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const debouncedUserSearch = useDebounce(userSearch, 400)

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

  // Query members for selected tontine
  const { data: membersData, refetch: refetchMembers } = useQuery({
    queryKey: ['tontine-members', membersTontine?.id],
    queryFn: () => apiService.getTontineMembers(membersTontine!.id),
    enabled: !!membersTontine,
  })

  // Query users for autocomplete
  const { data: usersData } = useQuery({
    queryKey: ['users-search-tontine', debouncedUserSearch],
    queryFn: () => apiService.getUsers({ page: 1, page_size: 20, search: debouncedUserSearch || undefined }),
    enabled: addMemberOpen,
  })
  const usersList = usersData?.items || usersData || []

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

  // Mutation add member
  const addMemberMutation = useMutation({
    mutationFn: () => apiService.addTontineMember(membersTontine!.id, {
      user_id: selectedUserId!,
      contribution_amount: parseFloat(memberContribution),
    }),
    onSuccess: () => {
      enqueueSnackbar('Membre ajoute avec succes', { variant: 'success' })
      refetchMembers()
      queryClient.invalidateQueries({ queryKey: ['tontines'] })
      setAddMemberOpen(false)
      setSelectedUserId(null)
      setMemberContribution('')
      setUserSearch('')
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de l\'ajout', { variant: 'error' })
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
      message: `Declencher le cycle ${(tontine.current_cycle || 0) + 1} de la tontine "${tontine.name}" ? Le beneficiaire sera selectionne et les fonds distribues.`,
      severity: 'warning',
      action: () => { triggerCycleMutation.mutate(tontine.id); setConfirmDialog(d => ({ ...d, open: false })) },
    })
  }

  const handleViewDetails = (tontine: Tontine) => {
    setSelectedTontine(tontine)
    setDetailsOpen(true)
  }

  const handleViewMembers = (tontine: Tontine) => {
    setMembersTontine(tontine)
    setMembersOpen(true)
  }

  const formatCurrency = (amount: number) => {
    if (isNaN(amount) || amount === null || amount === undefined) return '0 XOF'
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' XOF'
  }

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      daily: 'Quotidien',
      weekly: 'Hebdomadaire',
      monthly: 'Mensuel',
    }
    return labels[freq] || freq
  }

  const getDistributionLabel = (method: string) => {
    const labels: Record<string, string> = {
      rotating: 'Rotation',
      random: 'Aleatoire',
      vote: 'Vote',
    }
    return labels[method] || method
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
      label: 'Contribution',
      align: 'right',
      render: (tontine) => formatCurrency(tontine.contribution_amount || 0),
    },
    {
      id: 'target_amount',
      label: 'Montant cible',
      align: 'right',
      render: (tontine) => formatCurrency(tontine.target_amount || 0),
    },
    {
      id: 'frequency',
      label: 'Frequence',
      render: (tontine) => (
        <Chip label={getFrequencyLabel(tontine.frequency)} size="small" />
      ),
    },
    {
      id: 'members',
      label: 'Membres',
      align: 'center',
      render: (tontine) => (
        <Tooltip title="Voir les membres">
          <Box
            display="flex"
            alignItems="center"
            gap={0.5}
            justifyContent="center"
            sx={{ cursor: 'pointer' }}
            onClick={() => handleViewMembers(tontine)}
          >
            <People fontSize="small" color="action" />
            <Typography variant="body2">
              {tontine.current_members || 0}/{tontine.max_members || '-'}
            </Typography>
          </Box>
        </Tooltip>
      ),
    },
    {
      id: 'current_cycle',
      label: 'Cycle',
      align: 'center',
      render: (tontine) => (
        <Chip label={`Cycle ${tontine.current_cycle || 0}`} size="small" color="info" />
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
          <Tooltip title="Gerer les membres">
            <IconButton size="small" color="primary" onClick={() => handleViewMembers(tontine)}>
              <People fontSize="small" />
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
            <MenuItem value="open">Ouvert</MenuItem>
            <MenuItem value="active">Actif</MenuItem>
            <MenuItem value="completed">Complete</MenuItem>
            <MenuItem value="cancelled">Annule</MenuItem>
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

      {/* Dialog details tontine */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Details de la tontine</DialogTitle>
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
                  {formatCurrency(selectedTontine.contribution_amount || 0)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Montant cible
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  {formatCurrency(selectedTontine.target_amount || 0)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Frequence
                </Typography>
                <Typography variant="body1">
                  {getFrequencyLabel(selectedTontine.frequency)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Methode de distribution
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
                  Cycle {selectedTontine.current_cycle || 0}
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
                      selectedTontine.max_members > 0
                        ? ((selectedTontine.current_members || 0) / selectedTontine.max_members) * 100
                        : 0
                    }
                    sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2">
                    {selectedTontine.current_members || 0}/{selectedTontine.max_members || '-'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Date de creation
                </Typography>
                <Typography variant="body1">
                  {selectedTontine.created_at
                    ? format(new Date(selectedTontine.created_at), 'dd/MM/yyyy HH:mm')
                    : '-'}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<People />}
            onClick={() => {
              setDetailsOpen(false)
              if (selectedTontine) handleViewMembers(selectedTontine)
            }}
          >
            Voir les membres
          </Button>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog members */}
      <Dialog
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Membres - {membersTontine?.name}
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<PersonAdd />}
              onClick={() => setAddMemberOpen(true)}
              sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' }, textTransform: 'none' }}
            >
              Ajouter un membre
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {Array.isArray(membersData) && membersData.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell><strong>Ordre</strong></TableCell>
                    <TableCell><strong>Nom</strong></TableCell>
                    <TableCell><strong>Email</strong></TableCell>
                    <TableCell align="right"><strong>Contribution</strong></TableCell>
                    <TableCell><strong>Rejoint le</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(membersData as TontineMember[]).map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <Chip label={`#${member.order}`} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>{member.user_name || 'Inconnu'}</TableCell>
                      <TableCell>{member.user_email || '-'}</TableCell>
                      <TableCell align="right">{formatCurrency(member.contribution_amount)}</TableCell>
                      <TableCell>
                        {member.joined_at
                          ? format(new Date(member.joined_at), 'dd/MM/yyyy')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <People sx={{ fontSize: 48, color: '#CBD5E1', mb: 1 }} />
              <Typography color="text.secondary">
                Aucun membre pour le moment
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Ajoutez des membres pour demarrer la tontine
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMembersOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog add member */}
      <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter un membre a la tontine</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={usersList}
                getOptionLabel={(option: any) =>
                  `${option.first_name || ''} ${option.last_name || ''} (${option.email})`.trim()
                }
                isOptionEqualToValue={(option: any, value: any) => option.id === value.id}
                onInputChange={(_, value) => setUserSearch(value)}
                onChange={(_, value: any) => setSelectedUserId(value?.id || null)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Rechercher un utilisateur"
                    placeholder="Tapez un nom ou email..."
                    fullWidth
                  />
                )}
                noOptionsText="Aucun utilisateur trouve"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Montant de contribution (XOF)"
                type="number"
                value={memberContribution}
                onChange={(e) => setMemberContribution(e.target.value)}
                placeholder="Ex: 25000"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddMemberOpen(false); setSelectedUserId(null); setMemberContribution('') }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={() => addMemberMutation.mutate()}
            disabled={!selectedUserId || !memberContribution || addMemberMutation.isPending}
            sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
          >
            {addMemberMutation.isPending ? 'Ajout...' : 'Ajouter'}
          </Button>
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

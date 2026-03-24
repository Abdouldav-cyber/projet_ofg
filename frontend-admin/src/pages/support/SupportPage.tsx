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
  Add,
  Chat,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import { SupportTicket, TicketPriority, TicketStatus } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import ChatWindow from './ChatWindow'

export default function SupportPage() {
  const { hasPermission } = useAuth()
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('open')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatTicket, setChatTicket] = useState<SupportTicket | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium' as TicketPriority,
  })

  const debouncedSearch = useDebounce(search, 500)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['support-tickets', page, pageSize, debouncedSearch, statusFilter, priorityFilter],
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
      if (priorityFilter !== 'all') {
        params.priority = priorityFilter
      }

      const response = await apiService.getTickets(params)
      return response
    },
  })

  const createTicketMutation = useMutation({
    mutationFn: async (data: { subject: string; description: string; priority: TicketPriority }) => {
      return await apiService.createTicket(data)
    },
    onSuccess: () => {
      enqueueSnackbar('Ticket créé avec succès', { variant: 'success' })
      setCreateDialogOpen(false)
      setFormData({ subject: '', description: '', priority: 'medium' })
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
      refetch()
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la création du ticket', {
        variant: 'error',
      })
    },
  })

  const handleViewDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setDetailsOpen(true)
  }

  const handleOpenChat = (ticket: SupportTicket) => {
    setChatTicket(ticket)
    setChatOpen(true)
  }

  const handleCreateTicket = () => {
    if (!formData.subject.trim() || !formData.description.trim()) {
      enqueueSnackbar('Veuillez remplir tous les champs', { variant: 'warning' })
      return
    }
    createTicketMutation.mutate(formData)
  }

  const getPriorityColor = (priority: TicketPriority) => {
    const colors: Record<TicketPriority, 'default' | 'info' | 'warning' | 'error'> = {
      low: 'default',
      medium: 'info',
      high: 'warning',
      urgent: 'error',
    }
    return colors[priority]
  }

  const getPriorityLabel = (priority: TicketPriority) => {
    const labels: Record<TicketPriority, string> = {
      low: 'Basse',
      medium: 'Moyenne',
      high: 'Haute',
      urgent: 'Urgente',
    }
    return labels[priority]
  }

  const columns: Column<SupportTicket>[] = [
    {
      id: 'id',
      label: 'ID Ticket',
      render: (ticket) => (
        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace' }}>
          #{ticket.id.substring(0, 8)}
        </Typography>
      ),
    },
    {
      id: 'subject',
      label: 'Sujet',
      sortable: true,
      minWidth: 200,
    },
    {
      id: 'priority',
      label: 'Priorité',
      render: (ticket) => (
        <Chip
          label={getPriorityLabel(ticket.priority)}
          size="small"
          color={getPriorityColor(ticket.priority)}
        />
      ),
    },
    {
      id: 'status',
      label: 'Statut',
      render: (ticket) => <StatusChip status={ticket.status} />,
    },
    {
      id: 'created_at',
      label: 'Créé le',
      sortable: true,
      render: (ticket) => format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm'),
    },
    {
      id: 'updated_at',
      label: 'Mis à jour',
      render: (ticket) => format(new Date(ticket.updated_at), 'dd/MM/yyyy HH:mm'),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (ticket) => (
        <Box display="flex" gap={0.5} justifyContent="flex-end">
          <Tooltip title="Chat live">
            <IconButton
              size="small"
              onClick={() => handleOpenChat(ticket)}
              disabled={ticket.status === 'closed'}
              sx={{ color: '#2563EB' }}
            >
              <Chat fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Voir détails">
            <IconButton size="small" onClick={() => handleViewDetails(ticket)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h3">
            Support client
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
            Gerez les tickets et assistez les clients
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          disabled={!hasPermission('tickets:create')}
          onClick={() => setCreateDialogOpen(true)}
        >
          Nouveau ticket
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
          placeholder="Rechercher un ticket..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 300 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Priorité</InputLabel>
          <Select
            value={priorityFilter}
            label="Priorité"
            onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')}
          >
            <MenuItem value="all">Toutes</MenuItem>
            <MenuItem value="low">Basse</MenuItem>
            <MenuItem value="medium">Moyenne</MenuItem>
            <MenuItem value="high">Haute</MenuItem>
            <MenuItem value="urgent">Urgente</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Statut</InputLabel>
          <Select
            value={statusFilter}
            label="Statut"
            onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}
          >
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="open">Ouvert</MenuItem>
            <MenuItem value="in_progress">En cours</MenuItem>
            <MenuItem value="resolved">Résolu</MenuItem>
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

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        totalCount={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(ticket) => ticket.id}
      />

      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Détails du ticket</DialogTitle>
        <DialogContent>
          {selectedTicket && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="h6">{selectedTicket.subject}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1">{selectedTicket.description}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Priorité
                </Typography>
                <Box mt={0.5}>
                  <Chip
                    label={getPriorityLabel(selectedTicket.priority)}
                    color={getPriorityColor(selectedTicket.priority)}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Statut
                </Typography>
                <Box mt={0.5}>
                  <StatusChip status={selectedTicket.status} />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Créé le
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedTicket.created_at), 'dd/MM/yyyy à HH:mm')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Dernière mise à jour
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedTicket.updated_at), 'dd/MM/yyyy à HH:mm')}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Créer un nouveau ticket</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              label="Sujet"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Ex: Problème de connexion au compte"
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Décrivez le problème en détail..."
              multiline
              rows={4}
            />
            <FormControl fullWidth>
              <InputLabel>Priorité</InputLabel>
              <Select
                value={formData.priority}
                label="Priorité"
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
              >
                <MenuItem value="low">Basse</MenuItem>
                <MenuItem value="medium">Moyenne</MenuItem>
                <MenuItem value="high">Haute</MenuItem>
                <MenuItem value="urgent">Urgente</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={createTicketMutation.isPending}>
            Annuler
          </Button>
          <Button
            onClick={handleCreateTicket}
            variant="contained"
            disabled={createTicketMutation.isPending}
          >
            {createTicketMutation.isPending ? 'Création...' : 'Créer le ticket'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Chat Live Dialog */}
      <Dialog
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { height: '70vh', maxHeight: 700 }
        }}
      >
        {chatTicket && (
          <ChatWindow
            ticket={chatTicket}
            onClose={() => setChatOpen(false)}
          />
        )}
      </Dialog>
    </Box>
  )
}

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
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import { AuditLog } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'

const actionTypes = [
  'user.created',
  'user.updated',
  'user.deleted',
  'account.created',
  'account.frozen',
  'account.unfrozen',
  'account.closed',
  'transaction.created',
  'transaction.refunded',
  'kyc.approved',
  'kyc.rejected',
  'login.success',
  'login.failed',
  'config.updated',
]

export default function AuditLogsPage() {
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, pageSize, debouncedSearch, actionFilter],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        page_size: pageSize,
      }

      if (debouncedSearch) {
        params.search = debouncedSearch
      }
      if (actionFilter !== 'all') {
        params.action = actionFilter
      }

      return apiService.getAuditLogs(params)
    },
    enabled: hasPermission('audit:read'),
  })

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log)
    setDetailsOpen(true)
  }

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'success'
    if (action.includes('deleted') || action.includes('failed')) return 'error'
    if (action.includes('updated') || action.includes('approved')) return 'info'
    if (action.includes('frozen') || action.includes('rejected')) return 'warning'
    return 'default'
  }

  const columns: Column<AuditLog>[] = [
    {
      id: 'action',
      label: 'Action',
      sortable: true,
      render: (log) => (
        <Chip
          label={log.action}
          size="small"
          color={getActionColor(log.action) as any}
          variant="outlined"
        />
      ),
    },
    {
      id: 'user_email',
      label: 'Utilisateur',
      minWidth: 180,
    },
    {
      id: 'ip_address',
      label: 'Adresse IP',
      render: (log) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {log.ip_address}
        </Typography>
      ),
    },
    {
      id: 'timestamp',
      label: 'Date/Heure',
      sortable: true,
      minWidth: 160,
      render: (log) => format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss'),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (log) => (
        <Tooltip title="Voir détails">
          <IconButton size="small" onClick={() => handleViewDetails(log)}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ]

  if (!hasPermission('audit:read')) {
    return (
      <Box p={3}>
        <Typography variant="h5" gutterBottom>
          Accès refusé
        </Typography>
        <Typography color="text.secondary">
          Vous n'avez pas la permission d'accéder aux journaux d'audit.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h3">
            Journaux d'audit
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
            Tracabilite de toutes les actions du systeme
          </Typography>
        </Box>
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
          placeholder="Rechercher par utilisateur, IP..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 300 }}
        />

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Type d'action</InputLabel>
          <Select
            value={actionFilter}
            label="Type d'action"
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <MenuItem value="all">Toutes</MenuItem>
            {actionTypes.map((action) => (
              <MenuItem key={action} value={action}>
                {action}
              </MenuItem>
            ))}
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
        rowKey={(log) => log.id}
      />

      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Détails du journal d'audit</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Action
                </Typography>
                <Box mt={0.5}>
                  <Chip
                    label={selectedLog.action}
                    color={getActionColor(selectedLog.action) as any}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Date/Heure
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy à HH:mm:ss')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Utilisateur
                </Typography>
                <Typography variant="body1">{selectedLog.user_email}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Adresse IP
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {selectedLog.ip_address}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  ID Utilisateur
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {selectedLog.user_id}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Détails supplémentaires
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    mt: 1,
                    p: 2,
                    backgroundColor: 'grey.100',
                    borderRadius: 1,
                    overflow: 'auto',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {JSON.stringify(selectedLog.details, null, 2)}
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

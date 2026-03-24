import { useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from '@mui/material'
import {
  Search,
  Refresh,
  Add,
  Assessment,
  SettingsApplications,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import LoadingButton from '@/components/common/LoadingButton'
import { Tenant } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'

const tenantSchema = z.object({
  code: z.string().min(2).max(3).toUpperCase(),
  name: z.string().min(2),
  currency: z.string().length(3).toUpperCase(),
})

type TenantFormData = z.infer<typeof tenantSchema>

export default function TenantsPage() {
  const { hasPermission } = useAuth()
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [configTenant, setConfigTenant] = useState<Tenant | null>(null)
  const [configData, setConfigData] = useState<Record<string, any>>({})

  const debouncedSearch = useDebounce(search, 500)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenants', page, pageSize, debouncedSearch],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        page_size: pageSize,
      }

      if (debouncedSearch) {
        params.search = debouncedSearch
      }

      return apiService.getTenants(params)
    },
    enabled: hasPermission('tenants:read'),
  })

  const createMutation = useMutation({
    mutationFn: (data: TenantFormData) => apiService.createTenant({
      name: data.name,
      country_code: data.code,
      base_currency: data.currency,
    }),
    onSuccess: () => {
      enqueueSnackbar('Pays créé avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setCreateOpen(false)
      reset()
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la création', {
        variant: 'error',
      })
    },
  })

  const handleViewDetails = async (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setDetailsOpen(true)
  }

  const onSubmit = (data: TenantFormData) => {
    createMutation.mutate(data)
  }

  const handleOpenConfig = async (tenant: Tenant) => {
    setConfigTenant(tenant)
    try {
      const config = await apiService.getTenantConfig(tenant.id)
      setConfigData(config || {})
    } catch {
      setConfigData({})
    }
    setConfigOpen(true)
  }

  const configMutation = useMutation({
    mutationFn: () => apiService.updateTenantConfig(configTenant!.id, configData),
    onSuccess: () => {
      enqueueSnackbar('Configuration mise a jour', { variant: 'success' })
      setConfigOpen(false)
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur de sauvegarde', { variant: 'error' })
    },
  })

  const columns: Column<Tenant>[] = [
    {
      id: 'code',
      label: 'Code',
      sortable: true,
      render: (tenant) => (
        <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
          {tenant.code}
        </Typography>
      ),
    },
    {
      id: 'name',
      label: 'Nom du pays',
      sortable: true,
      minWidth: 180,
    },
    {
      id: 'currency',
      label: 'Devise',
      render: (tenant) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {tenant.currency}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Statut',
      render: (tenant) => <StatusChip status={tenant.status} />,
    },
    {
      id: 'created_at',
      label: 'Date de création',
      sortable: true,
      render: (tenant) => format(new Date(tenant.created_at), 'dd/MM/yyyy'),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (tenant) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Tooltip title="Voir analytiques">
            <IconButton size="small" onClick={() => handleViewDetails(tenant)}>
              <Assessment fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Configuration">
            <IconButton size="small" onClick={() => handleOpenConfig(tenant)}>
              <SettingsApplications fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ]

  if (!hasPermission('tenants:read')) {
    return (
      <Box p={3}>
        <Typography variant="h5" gutterBottom>
          Accès refusé
        </Typography>
        <Typography color="text.secondary">
          Vous devez être Super Admin pour accéder à cette page.
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h3">
            Gestion des pays (Tenants)
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
            Configurez et gerez les tenants par pays
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateOpen(true)}
          disabled={!hasPermission('tenants:create')}
        >
          Ajouter un pays
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
          placeholder="Rechercher un pays..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 300 }}
        />

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
        rowKey={(tenant) => tenant.id}
      />

      {/* Dialog de création */}
      <Dialog
        open={createOpen}
        onClose={() => !createMutation.isPending && setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>Ajouter un nouveau pays</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={2}>
              <TextField
                fullWidth
                label="Code pays"
                placeholder="SN, CI, GH, NG..."
                {...register('code')}
                error={!!errors.code}
                helperText={errors.code?.message}
                inputProps={{ maxLength: 3 }}
              />

              <TextField
                fullWidth
                label="Nom du pays"
                placeholder="Sénégal, Côte d'Ivoire..."
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message}
              />

              <TextField
                fullWidth
                label="Devise"
                placeholder="XOF, EUR, USD..."
                {...register('currency')}
                error={!!errors.currency}
                helperText={errors.currency?.message}
                inputProps={{ maxLength: 3 }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Annuler
            </Button>
            <LoadingButton
              type="submit"
              variant="contained"
              loading={createMutation.isPending}
            >
              Créer
            </LoadingButton>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog de détails/analytiques */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Analytiques du pays</DialogTitle>
        <DialogContent>
          {selectedTenant && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Code pays
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  {selectedTenant.code}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Nom
                </Typography>
                <Typography variant="h5">{selectedTenant.name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Devise
                </Typography>
                <Typography variant="body1">{selectedTenant.currency}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Statut
                </Typography>
                <Box mt={0.5}>
                  <StatusChip status={selectedTenant.status} />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Date de création
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedTenant.created_at), 'dd/MM/yyyy à HH:mm')}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Les analytiques détaillées seront disponibles via l'API /admin/tenants/
                  {selectedTenant.id}/analytics
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de configuration tenant */}
      <Dialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Configuration - {configTenant?.name || ''}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <TextField
              fullWidth
              label="Limite de retrait journalier"
              type="number"
              value={configData.daily_withdrawal_limit || ''}
              onChange={(e) => setConfigData({ ...configData, daily_withdrawal_limit: parseFloat(e.target.value) || 0 })}
              helperText="Montant maximum de retrait par jour"
            />
            <TextField
              fullWidth
              label="Limite de transfert mensuel"
              type="number"
              value={configData.monthly_transfer_limit || ''}
              onChange={(e) => setConfigData({ ...configData, monthly_transfer_limit: parseFloat(e.target.value) || 0 })}
              helperText="Montant maximum de transfert par mois"
            />
            <TextField
              fullWidth
              label="Seuil de detection fraude"
              type="number"
              value={configData.fraud_threshold || ''}
              onChange={(e) => setConfigData({ ...configData, fraud_threshold: parseFloat(e.target.value) || 0 })}
              helperText="Score a partir duquel une transaction est bloquee (0-100)"
            />
            <TextField
              fullWidth
              label="Devise par defaut"
              value={configData.default_currency || ''}
              onChange={(e) => setConfigData({ ...configData, default_currency: e.target.value })}
            />
            <TextField
              fullWidth
              label="Fuseau horaire"
              value={configData.timezone || ''}
              onChange={(e) => setConfigData({ ...configData, timezone: e.target.value })}
              placeholder="Africa/Dakar"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)}>Annuler</Button>
          <LoadingButton
            variant="contained"
            onClick={() => configMutation.mutate()}
            loading={configMutation.isPending}
          >
            Sauvegarder
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

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
  Card,
  CardContent,
  Chip,
} from '@mui/material'
import {
  Search,
  Refresh,
  Visibility,
  Check,
  Close,
  Image as ImageIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import { KYCDocument, DocumentType, KYCStatus } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'

export default function KYCPage() {
  const { hasPermission } = useAuth()
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<KYCStatus | 'all'>('pending')
  const [selectedDocument, setSelectedDocument] = useState<KYCDocument | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectDialog, setRejectDialog] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  // Requête pour récupérer les documents KYC
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['kyc-documents', page, pageSize, debouncedSearch, typeFilter, statusFilter],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        page_size: pageSize,
      }

      if (debouncedSearch) {
        params.search = debouncedSearch
      }
      if (typeFilter !== 'all') {
        params.document_type = typeFilter
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      return apiService.getKYCDocuments(params)
    },
  })

  // Mutation pour approuver un document
  const approveMutation = useMutation({
    mutationFn: (documentId: string) => apiService.approveKYC(documentId),
    onSuccess: () => {
      enqueueSnackbar('Document KYC approuvé avec succès', { variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['kyc-documents'] })
      setDetailsOpen(false)
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.detail || 'Erreur lors de l\'approbation',
        { variant: 'error' }
      )
    },
  })

  // Mutation pour rejeter un document
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiService.rejectKYC(id, reason),
    onSuccess: () => {
      enqueueSnackbar('Document KYC rejeté', { variant: 'info' })
      queryClient.invalidateQueries({ queryKey: ['kyc-documents'] })
      setRejectDialog(false)
      setDetailsOpen(false)
      setRejectReason('')
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.detail || 'Erreur lors du rejet',
        { variant: 'error' }
      )
    },
  })

  const handleApprove = (document: KYCDocument) => {
    approveMutation.mutate(document.id)
  }

  const handleReject = (document: KYCDocument) => {
    setSelectedDocument(document)
    setRejectDialog(true)
  }

  const confirmReject = () => {
    if (!selectedDocument) return

    if (!rejectReason.trim()) {
      enqueueSnackbar('Veuillez indiquer une raison pour le rejet', {
        variant: 'warning',
      })
      return
    }

    rejectMutation.mutate({
      id: selectedDocument.id,
      reason: rejectReason,
    })
  }

  const handleViewDetails = (document: KYCDocument) => {
    setSelectedDocument(document)
    setDetailsOpen(true)
  }

  const getDocumentTypeLabel = (type: DocumentType) => {
    const labels: Record<DocumentType, string> = {
      passport: 'Passeport',
      national_id: 'Carte d\'identité nationale',
      drivers_license: 'Permis de conduire',
    }
    return labels[type] || type
  }

  const columns: Column<KYCDocument>[] = [
    {
      id: 'document_type',
      label: 'Type de document',
      render: (doc) => (
        <Chip
          label={getDocumentTypeLabel(doc.document_type)}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
    },
    {
      id: 'document_number',
      label: 'Numéro',
      render: (doc) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {doc.document_number}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Statut',
      render: (doc) => <StatusChip status={doc.status} />,
    },
    {
      id: 'submitted_at',
      label: 'Soumis le',
      sortable: true,
      render: (doc) => format(new Date(doc.submitted_at), 'dd/MM/yyyy HH:mm'),
    },
    {
      id: 'reviewed_at',
      label: 'Vérifié le',
      render: (doc) =>
        doc.reviewed_at ? (
          format(new Date(doc.reviewed_at), 'dd/MM/yyyy HH:mm')
        ) : (
          <Typography variant="caption" color="text.secondary">
            -
          </Typography>
        ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (doc) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Tooltip title="Voir détails">
            <IconButton size="small" onClick={() => handleViewDetails(doc)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>

          {hasPermission('kyc:approve') && doc.status === 'pending' && (
            <>
              <Tooltip title="Approuver">
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleApprove(doc)}
                >
                  <Check fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Rejeter">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleReject(doc)}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Tooltip>
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
            Validation KYC
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
            Verifiez et validez les documents d'identite
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
        <TextField
          placeholder="Rechercher par numéro..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 250 }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type de document</InputLabel>
          <Select
            value={typeFilter}
            label="Type de document"
            onChange={(e) => setTypeFilter(e.target.value as DocumentType | 'all')}
          >
            <MenuItem value="all">Tous</MenuItem>
            <MenuItem value="passport">Passeport</MenuItem>
            <MenuItem value="national_id">Carte d'identité</MenuItem>
            <MenuItem value="drivers_license">Permis de conduire</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Statut</InputLabel>
          <Select
            value={statusFilter}
            label="Statut"
            onChange={(e) => setStatusFilter(e.target.value as KYCStatus | 'all')}
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
        rowKey={(doc) => doc.id}
      />

      {/* Dialog de détails */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Détails du document KYC</DialogTitle>
        <DialogContent>
          {selectedDocument && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <ImageIcon color="primary" />
                      <Typography variant="h6">Document</Typography>
                    </Box>

                    {/* Placeholder pour l'image du document */}
                    <Box
                      sx={{
                        width: '100%',
                        height: 300,
                        backgroundColor: 'grey.100',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Image du document: {selectedDocument.document_url}
                      </Typography>
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                      URL: {selectedDocument.document_url}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Type de document
                </Typography>
                <Typography variant="body1">
                  {getDocumentTypeLabel(selectedDocument.document_type)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Numéro du document
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {selectedDocument.document_number}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Statut
                </Typography>
                <Box mt={0.5}>
                  <StatusChip status={selectedDocument.status} />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Date de soumission
                </Typography>
                <Typography variant="body1">
                  {format(
                    new Date(selectedDocument.submitted_at),
                    'dd/MM/yyyy à HH:mm'
                  )}
                </Typography>
              </Grid>

              {selectedDocument.reviewed_at && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Date de vérification
                  </Typography>
                  <Typography variant="body1">
                    {format(
                      new Date(selectedDocument.reviewed_at),
                      'dd/MM/yyyy à HH:mm'
                    )}
                  </Typography>
                </Grid>
              )}

              {selectedDocument.reviewed_by && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Vérifié par
                  </Typography>
                  <Typography variant="body1">
                    {selectedDocument.reviewed_by}
                  </Typography>
                </Grid>
              )}

              {selectedDocument.rejection_reason && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Raison du rejet
                  </Typography>
                  <Typography variant="body1" color="error">
                    {selectedDocument.rejection_reason}
                  </Typography>
                </Grid>
              )}

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  ID Utilisateur
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {selectedDocument.user_id}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {selectedDocument?.status === 'pending' && hasPermission('kyc:approve') && (
            <>
              <Button
                onClick={() => selectedDocument && handleReject(selectedDocument)}
                color="error"
                disabled={approveMutation.isPending}
              >
                Rejeter
              </Button>
              <Button
                onClick={() => selectedDocument && handleApprove(selectedDocument)}
                variant="contained"
                color="success"
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? 'En cours...' : 'Approuver'}
              </Button>
            </>
          )}
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de rejet */}
      <Dialog
        open={rejectDialog}
        onClose={() => !rejectMutation.isPending && setRejectDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rejeter le document KYC</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Vous êtes sur le point de rejeter le document{' '}
            <strong>
              {selectedDocument &&
                getDocumentTypeLabel(selectedDocument.document_type)}
            </strong>{' '}
            numéro <strong>{selectedDocument?.document_number}</strong>.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Raison du rejet"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Expliquez la raison du rejet (obligatoire)..."
            disabled={rejectMutation.isPending}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRejectDialog(false)
              setRejectReason('')
            }}
            disabled={rejectMutation.isPending}
          >
            Annuler
          </Button>
          <Button
            onClick={confirmReject}
            color="error"
            variant="contained"
            disabled={rejectMutation.isPending || !rejectReason.trim()}
          >
            {rejectMutation.isPending ? 'En cours...' : 'Confirmer le rejet'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

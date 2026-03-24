import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
} from '@mui/material'
import {
  Assessment,
  PictureAsPdf,
  Description,
  TableChart,
} from '@mui/icons-material'
import { useMutation } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'

type ReportType = 'transactions' | 'users' | 'accounts' | 'tontines' | 'support'
type ReportPeriod = 'daily' | 'weekly' | 'monthly'
type ReportFormat = 'pdf' | 'csv' | 'excel'

interface GeneratedReport {
  id: string
  type: ReportType
  period: ReportPeriod
  generatedAt: string
}

export default function ReportsPage() {
  const { hasPermission } = useAuth()
  const { enqueueSnackbar } = useSnackbar()

  const [reportType, setReportType] = useState<ReportType>('transactions')
  const [period, setPeriod] = useState<ReportPeriod>('monthly')
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([])

  // Generer un rapport (ajouter a la liste)
  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiService.getCountryReport({ period })
    },
    onSuccess: () => {
      enqueueSnackbar('Rapport pret. Cliquez sur une icone pour telecharger.', { variant: 'success' })

      const newReport: GeneratedReport = {
        id: Date.now().toString(),
        type: reportType,
        period,
        generatedAt: new Date().toISOString(),
      }
      setGeneratedReports([newReport, ...generatedReports])
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.detail || 'Erreur lors de la generation',
        { variant: 'error' }
      )
    },
  })

  // Telecharger un rapport
  const downloadMutation = useMutation({
    mutationFn: async ({ type, format, period }: { type: ReportType; format: ReportFormat; period: ReportPeriod }) => {
      const blob = await apiService.exportReport(type, format, period)
      const extensions: Record<ReportFormat, string> = { pdf: 'pdf', csv: 'csv', excel: 'xlsx' }
      const timestamp = new Date().toISOString().slice(0, 10)
      const filename = `djembe_${type}_${timestamp}.${extensions[format]}`
      apiService.downloadBlob(new Blob([blob]), filename)
      return format
    },
    onSuccess: (format) => {
      enqueueSnackbar(`Rapport ${format.toUpperCase()} telecharge`, { variant: 'success' })
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.detail || 'Erreur lors du telechargement',
        { variant: 'error' }
      )
    },
  })

  const handleGenerate = () => {
    generateMutation.mutate()
  }

  const handleDownload = (report: GeneratedReport, format: ReportFormat) => {
    downloadMutation.mutate({ type: report.type, format, period: report.period })
  }

  const getReportTypeLabel = (type: ReportType) => {
    const labels: Record<ReportType, string> = {
      transactions: 'Transactions',
      users: 'Utilisateurs',
      accounts: 'Comptes',
      tontines: 'Tontines',
      support: 'Support',
    }
    return labels[type]
  }

  const getPeriodLabel = (period: ReportPeriod) => {
    const labels: Record<ReportPeriod, string> = {
      daily: "Aujourd'hui",
      weekly: 'Cette semaine',
      monthly: 'Ce mois',
    }
    return labels[period]
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box mb={3}>
        <Typography variant="h3">
          Generation de rapports
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
          Generez et exportez vos rapports d'activite
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Formulaire de generation */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#1E293B', fontWeight: 600 }}>
                Nouveau rapport
              </Typography>

              <Box mt={3} display="flex" flexDirection="column" gap={2}>
                <FormControl fullWidth>
                  <InputLabel>Type de rapport</InputLabel>
                  <Select
                    value={reportType}
                    label="Type de rapport"
                    onChange={(e) => setReportType(e.target.value as ReportType)}
                  >
                    <MenuItem value="transactions">Transactions</MenuItem>
                    <MenuItem value="users">Utilisateurs</MenuItem>
                    <MenuItem value="accounts">Comptes</MenuItem>
                    <MenuItem value="tontines">Tontines</MenuItem>
                    <MenuItem value="support">Support</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Periode</InputLabel>
                  <Select
                    value={period}
                    label="Periode"
                    onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
                  >
                    <MenuItem value="daily">Aujourd'hui</MenuItem>
                    <MenuItem value="weekly">Cette semaine</MenuItem>
                    <MenuItem value="monthly">Ce mois</MenuItem>
                  </Select>
                </FormControl>

                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleGenerate}
                  disabled={!hasPermission('reports:generate') || generateMutation.isPending}
                  startIcon={generateMutation.isPending ? <CircularProgress size={20} /> : <Assessment />}
                >
                  {generateMutation.isPending ? 'Generation...' : 'Generer le rapport'}
                </Button>

                {/* Telechargement direct rapide */}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Ou telecharger directement :
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PictureAsPdf sx={{ color: '#EF4444' }} />}
                    onClick={() => downloadMutation.mutate({ type: reportType, format: 'pdf', period })}
                    disabled={downloadMutation.isPending}
                    sx={{ flex: 1, borderColor: '#E2E8F0', color: '#1E293B' }}
                  >
                    PDF
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TableChart sx={{ color: '#10B981' }} />}
                    onClick={() => downloadMutation.mutate({ type: reportType, format: 'excel', period })}
                    disabled={downloadMutation.isPending}
                    sx={{ flex: 1, borderColor: '#E2E8F0', color: '#1E293B' }}
                  >
                    Excel
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Description sx={{ color: '#3B82F6' }} />}
                    onClick={() => downloadMutation.mutate({ type: reportType, format: 'csv', period })}
                    disabled={downloadMutation.isPending}
                    sx={{ flex: 1, borderColor: '#E2E8F0', color: '#1E293B' }}
                  >
                    CSV
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Liste des rapports generes */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" sx={{ color: '#1E293B', fontWeight: 600 }}>
                  Rapports generes
                </Typography>
                {generatedReports.length > 0 && (
                  <Chip
                    label={`${generatedReports.length} rapport(s)`}
                    size="small"
                    sx={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      color: '#1E293B',
                      fontWeight: 500,
                    }}
                  />
                )}
              </Box>

              {generatedReports.length === 0 ? (
                <Box py={6} textAlign="center">
                  <Assessment sx={{ fontSize: 64, color: '#CBD5E1', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Aucun rapport genere
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Utilisez le formulaire pour creer votre premier rapport
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, color: '#1E293B' }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#1E293B' }}>Periode</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#1E293B' }}>Date</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: '#1E293B' }}>Telecharger</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {generatedReports.map((report) => (
                        <TableRow key={report.id} hover>
                          <TableCell>
                            <Chip
                              label={getReportTypeLabel(report.type)}
                              size="small"
                              variant="outlined"
                              sx={{
                                borderColor: '#E2E8F0',
                                color: '#1E293B',
                                fontWeight: 500,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: '#6B7280' }}>
                              {getPeriodLabel(report.period)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ color: '#6B7280' }}>
                              {new Date(report.generatedAt).toLocaleDateString('fr-FR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Box display="flex" justifyContent="flex-end" gap={0.5}>
                              <Tooltip title="PDF">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownload(report, 'pdf')}
                                  disabled={downloadMutation.isPending}
                                  sx={{ '&:hover': { background: '#FEF2F2' } }}
                                >
                                  <PictureAsPdf fontSize="small" sx={{ color: '#EF4444' }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Excel">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownload(report, 'excel')}
                                  disabled={downloadMutation.isPending}
                                  sx={{ '&:hover': { background: '#F0FDF4' } }}
                                >
                                  <TableChart fontSize="small" sx={{ color: '#10B981' }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="CSV">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownload(report, 'csv')}
                                  disabled={downloadMutation.isPending}
                                  sx={{ '&:hover': { background: '#EFF6FF' } }}
                                >
                                  <Description fontSize="small" sx={{ color: '#3B82F6' }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

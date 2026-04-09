import { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress
} from '@mui/material'
import {
  Add,
  Delete,
  PieChart,
  WaterDrop,
  Agriculture
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '@/services/api'
import { useSnackbar } from 'notistack'

// Inline StatCard since we don't have a shared component
const StatCard = ({ title, value, icon, trend, color }: any) => (
  <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 2 }}>
    <Box sx={{ 
      p: 2, 
      borderRadius: '50%', 
      bgcolor: `${color}15`, 
      color: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {icon}
    </Box>
    <Box>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h5" fontWeight="bold">
        {value}
      </Typography>
      {trend && (
        <Typography variant="caption" sx={{ color: color, fontWeight: 'bold' }}>
          {trend}
        </Typography>
      )}
    </Box>
  </Paper>
)

export default function InvestmentsPage() {
  const queryClient = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()
  const [openAddDialog, setOpenAddDialog] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    category: 'Energie',
    annual_yield: 12,
    risk_level: 'Modéré',
    funding_goal: 50000000,
    min_investment: 10000
  })

  const { data: projects, isLoading } = useQuery({
    queryKey: ['admin-investments'],
    queryFn: () => apiService.getInvestmentProjects()
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiService.createInvestmentProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-investments'] })
      setOpenAddDialog(false)
      enqueueSnackbar('Projet ajouté avec succès', { variant: 'success' })
      setFormData({
        title: '', category: 'Energie', annual_yield: 12, risk_level: 'Modéré', funding_goal: 50000000, min_investment: 10000
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteInvestmentProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-investments'] })
      enqueueSnackbar('Le projet a été retiré', { variant: 'info' })
    }
  })

  const handleDelete = (id: string) => {
    if (window.confirm("Êtes-vous sûr ? Ce projet sera supprimé définitivement.")) {
      deleteMutation.mutate(id)
    }
  }

  const handleAddSubmit = () => {
    if (!formData.title) return
    createMutation.mutate(formData)
  }

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'faible': return 'success'
      case 'modéré': return 'warning'
      case 'elevé':
      case 'élevé': return 'error'
      default: return 'default'
    }
  }

  if (isLoading) return <Box p={3}><CircularProgress /></Box>

  // Calculs dynamiques basés sur les vraies données
  const activeProjects = projects?.length || 0

  const totalCollected = projects?.reduce((sum: number, p: any) => sum + (Number(p.current_funding) || 0), 0) || 0
  const formattedCollected = totalCollected >= 1000000 
    ? `${(totalCollected / 1000000).toFixed(1)}M XOF` 
    : `${totalCollected.toLocaleString()} XOF`

  const categories = projects?.map((p: any) => p.category) || []
  const dominantSector = categories.length > 0
    ? categories.sort((a: string, b: string) => categories.filter((v: string) => v === a).length - categories.filter((v: string) => v === b).length).pop()
    : 'Aucun'

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ color: '#1E293B', mb: 1 }}>
            Micro-Investissements
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez les projets participatifs proposés à vos clients
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenAddDialog(true)}
          sx={{
            bgcolor: '#9333EA',
            '&:hover': { bgcolor: '#7E22CE' },
            textTransform: 'none',
            borderRadius: '8px'
          }}
        >
          Nouveau Projet
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <StatCard
            title="Projets Actifs"
            value={activeProjects}
            icon={<PieChart />}
            trend=""
            color="#9333EA"
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <StatCard
            title="Secteur dominant"
            value={dominantSector}
            icon={<Agriculture />}
            trend=""
            color="#10B981"
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <StatCard
            title="Fonds Collectés"
            value={formattedCollected}
            icon={<WaterDrop />}
            trend=""
            color="#3B82F6"
          />
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#F8FAFC' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Titre du Projet</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Catégorie</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Objectif</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Rendement Annuel</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Risque</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Ticket Min.</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                  Aucun projet d'investissement disponible.
                </TableCell>
              </TableRow>
            )}
            {projects?.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell>{row.funding_goal.toLocaleString()} {row.currency}</TableCell>
                <TableCell sx={{ color: '#10B981', fontWeight: 'bold' }}>{row.annual_yield}%</TableCell>
                <TableCell>
                  <Chip
                    label={row.risk_level}
                    color={getRiskColor(row.risk_level) as any}
                    size="small"
                    sx={{ fontWeight: 500 }}
                  />
                </TableCell>
                <TableCell>{row.min_investment.toLocaleString()} {row.currency}</TableCell>
                <TableCell sx={{ textAlign: 'right' }}>
                  <Tooltip title="Supprimer">
                    <IconButton color="error" onClick={() => handleDelete(row.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Créer un projet d'investissement</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Titre du projet (ex: Ferme Solaire Dakar)"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label="Catégorie"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              fullWidth
            >
              <MenuItem value="Energie">Énergie Renouvelable</MenuItem>
              <MenuItem value="Agriculture">Agriculture</MenuItem>
              <MenuItem value="Immobilier">Immobilier</MenuItem>
              <MenuItem value="Technologie">Technologie</MenuItem>
            </TextField>
            <TextField
              label="Objectif de collecte (XOF)"
              type="number"
              value={formData.funding_goal}
              onChange={e => setFormData({ ...formData, funding_goal: Number(e.target.value) })}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Rendement Annuel (%)"
                type="number"
                value={formData.annual_yield}
                onChange={e => setFormData({ ...formData, annual_yield: Number(e.target.value) })}
                fullWidth
              />
              <TextField
                select
                label="Niveau de Risque"
                value={formData.risk_level}
                onChange={e => setFormData({ ...formData, risk_level: e.target.value })}
                fullWidth
              >
                <MenuItem value="Faible">Faible</MenuItem>
                <MenuItem value="Modéré">Modéré</MenuItem>
                <MenuItem value="Élevé">Élevé</MenuItem>
              </TextField>
            </Box>
            <TextField
              label="Investissement Minimum (XOF)"
              type="number"
              value={formData.min_investment}
              onChange={e => setFormData({ ...formData, min_investment: Number(e.target.value) })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenAddDialog(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleAddSubmit}
            disabled={createMutation.isPending}
            sx={{ bgcolor: '#9333EA', '&:hover': { bgcolor: '#7E22CE' } }}
          >
            {createMutation.isPending ? 'Création...' : 'Créer le projet'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

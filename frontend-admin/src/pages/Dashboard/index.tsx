import { useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from '@mui/material'
import {
  People,
  Receipt,
  TrendingUp,
  AccountBalance,
} from '@mui/icons-material'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiService from '@/services/api'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface StatCardProps {
  title: string
  value: string | number
  icon: JSX.Element
}

function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid #E2E8F0',
        borderRadius: 2,
        height: '100%'
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2
            }}
          >
            <Box sx={{ color: '#3B82F6', display: 'flex' }}>{icon}</Box>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
              {value}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { subscribe } = useWebSocket()
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => apiService.getDashboardStats(),
    refetchInterval: 30000,
  })

  useEffect(() => {
    const unsubTransaction = subscribe('transaction.completed', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    })
    const unsubBalance = subscribe('account.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    })
    return () => {
      unsubTransaction()
      unsubBalance()
    }
  }, [subscribe, queryClient])

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={40} />
      </Box>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 1200, margin: '0 auto', pt: 2 }}>
      {/* HEADER */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 800, mb: 1 }}>
          Tableau de bord
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          Vue d'ensemble des activités de la banque
        </Typography>
      </Box>

      {/* KPI TOP ROW */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Utilisateurs totaux" 
            value={formatCurrency(stats?.total_users ?? 0)} 
            icon={<People sx={{ fontSize: 24 }} />} 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Transactions aujourd'hui" 
            value={formatCurrency(stats?.today_transactions ?? 0)} 
            icon={<TrendingUp sx={{ fontSize: 24 }} />} 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Volume transigé (XOF)" 
            value={formatCurrency(stats?.total_volume ?? 0)} 
            icon={<Receipt sx={{ fontSize: 24 }} />} 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Comptes actifs" 
            value={formatCurrency(stats?.active_accounts ?? 0)} 
            icon={<AccountBalance sx={{ fontSize: 24 }} />} 
          />
        </Grid>
      </Grid>
      
      {/* CHARTS */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2, height: '100%', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: 'text.primary', fontSize: 14, fontWeight: 700, mb: 3 }}>
                Croissance utilisateurs (7 jours)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats?.user_growth || []} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsersLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorUsersLight)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2, height: '100%', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ color: 'text.primary', fontSize: 14, fontWeight: 700, mb: 3 }}>
                Volume des transactions (7 jours)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats?.transaction_volume || []} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="volume" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

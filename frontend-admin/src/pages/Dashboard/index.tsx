import { useEffect } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
  alpha,
} from '@mui/material'
import {
  People,
  AccountBalance,
  Receipt,
  TrendingUp,
  ArrowUpward,
  Circle,
} from '@mui/icons-material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiService from '@/services/api'
import { useTranslation } from 'react-i18next'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface StatCardProps {
  title: string
  value: string | number
  icon: JSX.Element
  color: string
  trend?: string
}

function StatCard({ title, value, icon, color, trend }: StatCardProps) {
  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'visible',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.06)',
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              background: alpha(color, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          </Box>
          {trend && (
            <Chip
              icon={<ArrowUpward sx={{ fontSize: '13px !important', color: '#16A34A !important' }} />}
              label={trend}
              size="small"
              sx={{
                height: 24,
                bgcolor: '#F0FDF4',
                color: '#16A34A',
                fontWeight: 600,
                fontSize: 11,
                border: '1px solid #BBF7D0',
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          )}
        </Box>

        <Typography sx={{ fontSize: 13, color: '#64748B', fontWeight: 500, mb: 0.5 }}>
          {title}
        </Typography>

        <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#1E293B' }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { isConnected, subscribe } = useWebSocket()
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
        <CircularProgress size={40} sx={{ color: '#7C3AED' }} />
      </Box>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* En-tete */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h3" sx={{ mb: 0.5 }}>
            {t('dashboard.title')}
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748B' }}>
            Bienvenue sur votre tableau de bord Djembe Bank
          </Typography>
        </Box>
        <Chip
          icon={<Circle sx={{ fontSize: '8px !important' }} />}
          label={isConnected ? 'Temps reel actif' : 'Hors ligne'}
          size="small"
          sx={{
            height: 28,
            bgcolor: isConnected ? '#F0FDF4' : '#FEF2F2',
            color: isConnected ? '#16A34A' : '#DC2626',
            border: `1px solid ${isConnected ? '#BBF7D0' : '#FECACA'}`,
            fontWeight: 500,
            fontSize: 12,
            '& .MuiChip-icon': {
              color: isConnected ? '#22C55E' : '#EF4444',
            },
          }}
        />
      </Box>

      {/* Cartes de statistiques */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.totalUsers')}
            value={formatCurrency(stats?.total_users ?? 0)}
            icon={<People sx={{ fontSize: 24 }} />}
            color="#7C3AED"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.activeAccounts')}
            value={formatCurrency(stats?.active_accounts ?? 0)}
            icon={<AccountBalance sx={{ fontSize: 24 }} />}
            color="#3B82F6"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.todayTransactions')}
            value={formatCurrency(stats?.today_transactions ?? 0)}
            icon={<Receipt sx={{ fontSize: 24 }} />}
            color="#10B981"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.totalVolume')}
            value={`${formatCurrency(stats?.total_volume ?? 0)} XOF`}
            icon={<TrendingUp sx={{ fontSize: 24 }} />}
            color="#F59E0B"
          />
        </Grid>
      </Grid>

      {/* Graphiques */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5, color: '#1E293B' }}>
                  {t('dashboard.userGrowth')}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#94A3B8' }}>
                  Evolution du nombre d'utilisateurs
                </Typography>
              </Box>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stats?.user_growth || []}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#94A3B8" style={{ fontSize: 12 }} />
                  <YAxis stroke="#94A3B8" style={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: 10,
                      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.08)',
                      fontSize: 13,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#7C3AED"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                    name="Utilisateurs"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5, color: '#1E293B' }}>
                  {t('dashboard.transactionVolume')}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#94A3B8' }}>
                  Volume mensuel des transactions (XOF)
                </Typography>
              </Box>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stats?.transaction_volume || []}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#94A3B8" style={{ fontSize: 12 }} />
                  <YAxis
                    stroke="#94A3B8"
                    style={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value / 1000000}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: 10,
                      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.08)',
                      fontSize: 13,
                    }}
                    formatter={(value: number) => [
                      `${formatCurrency(value)} XOF`,
                      'Volume',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorVolume)"
                    name="Volume (XOF)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

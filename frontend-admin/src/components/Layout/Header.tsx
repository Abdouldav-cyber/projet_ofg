import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle,
  Logout,
  Settings,
  Circle,
} from '@mui/icons-material'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiService from '@/services/api'
import { SIDEBAR_WIDTH } from './constants'

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

export default function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  const { user, logout } = useAuth()
  const { isConnected } = useWebSocket()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null)

  // Charger les derniers événements (audit logs) comme notifications
  const { data: auditData } = useQuery({
    queryKey: ['recentAuditLogs'],
    queryFn: () => apiService.getAuditLogs({ limit: 5, offset: 0 }),
    refetchInterval: 60000,
  })

  const recentLogs = auditData?.logs || []

  const getLogLabel = (action: string) => {
    const labels: Record<string, string> = {
      'LOGIN': 'Connexion utilisateur',
      'LOGOUT': 'Deconnexion',
      'TRANSFER': 'Nouvelle transaction',
      'CREATE_ACCOUNT': 'Nouveau compte cree',
      'UPDATE_KYC': 'Document KYC soumis',
      'KYC_APPROVED': 'KYC approuve',
      'KYC_REJECTED': 'KYC rejete',
      'FREEZE_ACCOUNT': 'Compte gele',
      'UNFREEZE_ACCOUNT': 'Compte degele',
      'CREATE_TONTINE': 'Nouvelle tontine creee',
      'JOIN_TONTINE': 'Nouveau membre tontine',
      'CREATE_USER': 'Nouvel utilisateur cree',
      'UPDATE_USER': 'Utilisateur modifie',
      'REFUND': 'Remboursement effectue',
    }
    return labels[action] || action
  }

  const getLogColor = (action: string) => {
    if (['LOGIN', 'LOGOUT'].includes(action)) return '#3B82F6'
    if (['TRANSFER', 'REFUND'].includes(action)) return '#7C3AED'
    if (action.includes('KYC')) return '#F59E0B'
    if (action.includes('TONTINE')) return '#10B981'
    if (action.includes('FREEZE')) return '#EF4444'
    return '#6B7280'
  }

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'A l\'instant'
    if (diffMin < 60) return `Il y a ${diffMin} min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `Il y a ${diffH}h`
    const diffD = Math.floor(diffH / 24)
    return `Il y a ${diffD}j`
  }

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleNotifications = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchor(event.currentTarget)
  }

  const handleCloseNotif = () => {
    setNotifAnchor(null)
  }

  const handleLogout = () => {
    handleClose()
    logout()
  }

  const handleProfile = () => {
    handleClose()
    navigate('/settings')
  }

  const handleSettings = () => {
    handleClose()
    navigate('/settings')
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin'
      case 'country_admin':
        return 'Admin Pays'
      case 'support_l2':
        return 'Support L2'
      case 'support_l1':
        return 'Support L1'
      default:
        return role
    }
  }

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return '#7C3AED'
      case 'country_admin':
        return '#3B82F6'
      case 'support_l2':
        return '#F59E0B'
      case 'support_l1':
        return '#10B981'
      default:
        return '#6B7280'
    }
  }

  const roleColor = getRoleColor(user?.role)
  const showOffset = !isMobile && sidebarOpen

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E2E8F0',
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.easeInOut,
          duration: theme.transitions.duration.standard,
        }),
        ...(showOffset && {
          width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
          ml: `${SIDEBAR_WIDTH}px`,
        }),
      }}
    >
      <Toolbar sx={{ height: 70, px: { xs: 2, md: 3 } }}>
        <IconButton
          edge="start"
          aria-label="menu"
          onClick={onToggleSidebar}
          sx={{
            color: '#475569',
            '&:hover': {
              background: '#F1F5F9',
            },
          }}
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ flexGrow: 1 }} />

        {/* Indicateur WebSocket */}
        <Chip
          icon={<Circle sx={{ fontSize: '8px !important' }} />}
          label={isConnected ? 'En ligne' : 'Hors ligne'}
          size="small"
          sx={{
            mr: 1.5,
            height: 28,
            fontWeight: 500,
            fontSize: 12,
            bgcolor: isConnected ? '#F0FDF4' : '#FEF2F2',
            color: isConnected ? '#16A34A' : '#DC2626',
            border: `1px solid ${isConnected ? '#BBF7D0' : '#FECACA'}`,
            '& .MuiChip-icon': {
              color: isConnected ? '#22C55E' : '#EF4444',
            },
          }}
        />

        {/* Notifications */}
        <IconButton
          onClick={handleNotifications}
          sx={{
            color: '#64748B',
            '&:hover': { background: '#F1F5F9' },
          }}
        >
          <Badge
            badgeContent={recentLogs.length}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#EF4444',
                color: '#fff',
                fontSize: 10,
                height: 18,
                minWidth: 18,
              },
            }}
          >
            <NotificationsIcon sx={{ fontSize: 22 }} />
          </Badge>
        </IconButton>

        <Menu
          anchorEl={notifAnchor}
          open={Boolean(notifAnchor)}
          onClose={handleCloseNotif}
          PaperProps={{
            sx: {
              mt: 1.5,
              minWidth: 320,
              borderRadius: 3,
              border: '1px solid #E2E8F0',
              boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.08)',
            },
          }}
        >
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #F1F5F9' }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#1E293B' }}>
              Notifications
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              {recentLogs.length > 0 ? `${recentLogs.length} evenements recents` : 'Aucun evenement'}
            </Typography>
          </Box>
          {recentLogs.length === 0 ? (
            <MenuItem disabled sx={{ py: 2, px: 2.5 }}>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                Aucune activite recente
              </Typography>
            </MenuItem>
          ) : (
            recentLogs.map((log: any, i: number) => (
              <MenuItem key={log.id || i} onClick={handleCloseNotif} sx={{ py: 1.5, px: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: getLogColor(log.action),
                      mt: 0.8,
                      flexShrink: 0,
                    }}
                  />
                  <Box>
                    <Typography variant="body2" fontWeight={500} sx={{ color: '#1E293B' }}>
                      {getLogLabel(log.action)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      {log.created_at ? formatTimeAgo(log.created_at) : ''}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))
          )}
        </Menu>

        {/* Profil utilisateur */}
        <Box
          onClick={handleMenu}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            ml: 2,
            pl: 2,
            borderLeft: '1px solid #E2E8F0',
            cursor: 'pointer',
            py: 0.5,
            borderRadius: 2,
            '&:hover': {
              '& .user-name': { color: '#1E293B' },
            },
          }}
        >
          <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
            <Typography
              className="user-name"
              sx={{
                fontSize: 13.5,
                fontWeight: 600,
                color: '#334155',
                lineHeight: 1.3,
                transition: 'color 0.2s',
              }}
            >
              {user?.first_name} {user?.last_name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
              {getRoleLabel(user?.role)}
            </Typography>
          </Box>
          <Avatar
            sx={{
              width: 38,
              height: 38,
              bgcolor: `${roleColor}15`,
              color: roleColor,
              fontWeight: 700,
              fontSize: 14,
              border: `2px solid ${roleColor}30`,
            }}
          >
            {user?.first_name?.[0]?.toUpperCase() || 'A'}
          </Avatar>
        </Box>

        <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: {
              mt: 1.5,
              minWidth: 260,
              borderRadius: 3,
              border: '1px solid #E2E8F0',
              boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.08)',
            },
          }}
        >
          <Box sx={{ px: 2.5, py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: `${roleColor}15`,
                  color: roleColor,
                  fontWeight: 700,
                  fontSize: 16,
                  border: `2px solid ${roleColor}30`,
                }}
              >
                {user?.first_name?.[0]?.toUpperCase() || 'A'}
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#1E293B' }}>
                  {user?.first_name} {user?.last_name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#94A3B8' }}>
                  {user?.email}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={getRoleLabel(user?.role)}
              size="small"
              sx={{
                mt: 1.5,
                fontWeight: 600,
                fontSize: 11,
                bgcolor: `${roleColor}12`,
                color: roleColor,
                border: `1px solid ${roleColor}25`,
              }}
            />
          </Box>
          <Divider sx={{ borderColor: '#F1F5F9' }} />
          <MenuItem onClick={handleProfile} sx={{ py: 1.5, px: 2.5, color: '#475569' }}>
            <AccountCircle sx={{ mr: 1.5, fontSize: 20 }} />
            <Typography variant="body2" fontWeight={500}>Mon profil</Typography>
          </MenuItem>
          <MenuItem onClick={handleSettings} sx={{ py: 1.5, px: 2.5, color: '#475569' }}>
            <Settings sx={{ mr: 1.5, fontSize: 20 }} />
            <Typography variant="body2" fontWeight={500}>Parametres</Typography>
          </MenuItem>
          <Divider sx={{ borderColor: '#F1F5F9' }} />
          <MenuItem
            onClick={handleLogout}
            sx={{
              py: 1.5,
              px: 2.5,
              color: '#EF4444',
              '&:hover': { background: '#FEF2F2' },
            }}
          >
            <Logout sx={{ mr: 1.5, fontSize: 20 }} />
            <Typography variant="body2" fontWeight={600}>Deconnexion</Typography>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  )
}

import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Divider,
  Box,
  Typography,
  alpha,
} from '@mui/material'
import {
  Dashboard,
  People,
  AccountBalance,
  Receipt,
  VerifiedUser,
  Savings,
  Support,
  Assessment,
  History,
  Settings,
  Public,
  CurrencyExchange,
  NotificationsActive,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { SIDEBAR_WIDTH } from './constants'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

interface MenuItem {
  text: string
  icon: JSX.Element
  path: string
  permission?: string
  color: string
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = useAuth()

  const menuItems: MenuItem[] = [
    { text: 'Tableau de bord', icon: <Dashboard />, path: '/dashboard', color: '#7C3AED' },
    { text: 'Utilisateurs', icon: <People />, path: '/users', permission: 'users:read', color: '#10B981' },
    { text: 'Comptes', icon: <AccountBalance />, path: '/accounts', permission: 'accounts:read', color: '#3B82F6' },
    { text: 'Transactions', icon: <Receipt />, path: '/transactions', permission: 'transactions:read', color: '#F59E0B' },
    { text: 'Validation KYC', icon: <VerifiedUser />, path: '/kyc', permission: 'kyc:approve', color: '#8B5CF6' },
    { text: 'Tontines', icon: <Savings />, path: '/tontines', permission: 'tontines:read', color: '#14B8A6' },
    { text: 'Support', icon: <Support />, path: '/support', permission: 'tickets:update', color: '#EF4444' },
    { text: 'Rapports', icon: <Assessment />, path: '/reports', permission: 'reports:generate', color: '#6366F1' },
    { text: 'Audit Logs', icon: <History />, path: '/audit-logs', permission: 'audit:read', color: '#64748B' },
  ]

  const adminMenuItems: MenuItem[] = [
    { text: 'Gestion Pays', icon: <Public />, path: '/tenants', permission: 'tenants:read', color: '#7C3AED' },
    { text: 'Devises', icon: <CurrencyExchange />, path: '/currency', color: '#F59E0B' },
    { text: 'Notifications', icon: <NotificationsActive />, path: '/notifications', color: '#EF4444' },
    { text: 'Parametres', icon: <Settings />, path: '/settings', color: '#6B7280' },
  ]

  const handleNavigate = (path: string) => {
    navigate(path)
    if (isMobile) {
      onClose()
    }
  }

  const isActive = (path: string) => {
    return location.pathname.startsWith(path)
  }

  const renderMenuItems = (items: MenuItem[]) =>
    items.map((item) => {
      if (item.permission && !hasPermission(item.permission)) {
        return null
      }

      const active = isActive(item.path)

      return (
        <ListItem key={item.text} disablePadding sx={{ mb: 0.25, px: 1.5 }}>
          <ListItemButton
            onClick={() => handleNavigate(item.path)}
            selected={active}
            sx={{
              borderRadius: 2,
              py: 1.2,
              px: 1.5,
              transition: 'all 0.2s ease',
              ...(active
                ? {
                    background: alpha(item.color, 0.08),
                    '&:hover': {
                      background: alpha(item.color, 0.12),
                    },
                    '& .MuiListItemIcon-root': {
                      color: item.color,
                    },
                    '& .MuiListItemText-primary': {
                      color: '#1F2937',
                      fontWeight: 600,
                    },
                  }
                : {
                    '&:hover': {
                      backgroundColor: '#F1F5F9',
                      '& .MuiListItemIcon-root': {
                        color: item.color,
                      },
                    },
                  }),
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 38,
                color: item.color,
                '& svg': {
                  fontSize: 21,
                },
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              primaryTypographyProps={{
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                color: active ? '#1F2937' : '#64748B',
                letterSpacing: 0.1,
              }}
            />
            {active && (
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: item.color,
                  flexShrink: 0,
                }}
              />
            )}
          </ListItemButton>
        </ListItem>
      )
    })

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid #F1F5F9',
        }}
      >
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: 16 }}>
            DB
          </Typography>
        </Box>
        <Box>
          <Typography
            sx={{
              fontWeight: 700,
              color: '#1F2937',
              fontSize: 16,
              lineHeight: 1.2,
            }}
          >
            Djembe Bank
          </Typography>
          <Typography sx={{ color: '#94A3B8', fontSize: 11, fontWeight: 500 }}>
            Administration
          </Typography>
        </Box>
      </Box>

      {/* Menu principal */}
      <Box sx={{ flex: 1, overflow: 'auto', pt: 2 }}>
        <Typography
          variant="caption"
          sx={{
            color: '#94A3B8',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            fontSize: 10.5,
            px: 3,
            mb: 0.5,
            display: 'block',
          }}
        >
          Menu Principal
        </Typography>

        <List disablePadding sx={{ mb: 1 }}>
          {renderMenuItems(menuItems)}
        </List>

        <Divider sx={{ mx: 2.5, my: 1.5, borderColor: '#F1F5F9' }} />

        <Typography
          variant="caption"
          sx={{
            color: '#94A3B8',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            fontSize: 10.5,
            px: 3,
            mb: 0.5,
            display: 'block',
          }}
        >
          Administration
        </Typography>

        <List disablePadding>
          {renderMenuItems(adminMenuItems)}
        </List>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          mx: 1.5,
          mb: 1.5,
          borderRadius: 2,
          background: '#F8FAFC',
          border: '1px solid #F1F5F9',
          textAlign: 'center',
        }}
      >
        <Typography sx={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
          Djembe Bank v1.0.0
        </Typography>
        <Typography sx={{ fontSize: 10, color: '#CBD5E1' }}>
          2026 - Tous droits reserves
        </Typography>
      </Box>
    </Box>
  )

  // Mobile : Drawer temporaire (overlay)
  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
            background: '#FFFFFF',
            borderRight: '1px solid #E2E8F0',
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    )
  }

  // Desktop : Box fixe (pas de Drawer)
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: SIDEBAR_WIDTH,
        height: '100vh',
        background: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.03)',
        zIndex: theme.zIndex.drawer,
        transform: open ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
        transition: theme.transitions.create('transform', {
          easing: theme.transitions.easing.easeInOut,
          duration: theme.transitions.duration.standard,
        }),
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {sidebarContent}
    </Box>
  )
}

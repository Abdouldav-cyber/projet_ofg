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
  CreditCard,
  TrendingUp,
  Diversity3,
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
    { text: 'Cartes Bancaires', icon: <CreditCard />, path: '/cards', color: '#0F172A' },
    { text: 'Transactions', icon: <Receipt />, path: '/transactions', permission: 'transactions:read', color: '#F59E0B' },
    { text: 'Validation KYC', icon: <VerifiedUser />, path: '/kyc', permission: 'kyc:approve', color: '#8B5CF6' },
    { text: 'Tontines', icon: <Savings />, path: '/tontines', permission: 'tontines:read', color: '#14B8A6' },
    { text: 'Épargne', icon: <TrendingUp />, path: '/savings', color: '#84CC16' },
    { text: 'Réseau Social', icon: <Diversity3 />, path: '/circle', color: '#EC4899' },
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
              position: 'relative',
              transition: 'all 0.2s ease',
              ...(active
                ? {
                    background: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    borderRight: `3px solid ${theme.palette.primary.main}`,
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.primary.main,
                    },
                    '& .MuiListItemText-primary': {
                      fontWeight: 600,
                    },
                    '&:hover': {
                      background: alpha(theme.palette.primary.main, 0.15),
                    },
                  }
                : {
                    color: '#64748B',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      '& .MuiListItemIcon-root': {
                        color: theme.palette.primary.main,
                      },
                      '& .MuiListItemText-primary': {
                        color: theme.palette.text.primary,
                      },
                    },
                  }),
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 38,
                color: active ? theme.palette.primary.main : item.color,
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
                color: active ? theme.palette.primary.main : '#64748B',
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
          minHeight: 80,
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
          }}
        >
          <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 800, fontSize: 18, letterSpacing: 0.5 }}>
            DB
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontWeight: 800,
              color: 'text.primary',
              fontSize: 18,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Djembe Bank
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography sx={{ color: 'text.secondary', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Administration
            </Typography>
            <Box sx={{ background: 'rgba(124, 58, 237, 0.1)', px: 1, py: 0.2, borderRadius: 1 }}>
               <Typography sx={{ color: '#7C3AED', fontSize: 9, fontWeight: 700 }}>v1.0</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Menu principal */}
      <Box sx={{ flex: 1, overflow: 'auto', pt: 2, background: 'background.paper' }}>
        <Typography
          variant="caption"
          sx={{
            color: '#6B7280',
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

        <Divider sx={{ mx: 2.5, my: 1.5, borderColor: 'divider' }} />

        <Typography
          variant="caption"
          sx={{
            color: '#6B7280',
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
            background: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
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
        background: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        boxShadow: 'none',
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

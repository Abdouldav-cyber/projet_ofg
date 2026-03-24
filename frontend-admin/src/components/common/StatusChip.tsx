import { Chip } from '@mui/material'
import {
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Error,
  Info,
  Lock,
  Done,
} from '@mui/icons-material'

interface StatusConfig {
  label: string
  bg: string
  color: string
  borderColor: string
  icon?: JSX.Element
}

const statusConfigs: Record<string, StatusConfig> = {
  // User statuses
  active: {
    label: 'Actif',
    bg: '#F0FDF4',
    color: '#16A34A',
    borderColor: '#BBF7D0',
    icon: <CheckCircle sx={{ fontSize: 14 }} />,
  },
  inactive: {
    label: 'Inactif',
    bg: '#F8FAFC',
    color: '#64748B',
    borderColor: '#E2E8F0',
    icon: <Cancel sx={{ fontSize: 14 }} />,
  },

  // Account statuses
  frozen: {
    label: 'Gele',
    bg: '#FFFBEB',
    color: '#D97706',
    borderColor: '#FDE68A',
    icon: <Lock sx={{ fontSize: 14 }} />,
  },
  closed: {
    label: 'Ferme',
    bg: '#FEF2F2',
    color: '#DC2626',
    borderColor: '#FECACA',
    icon: <Cancel sx={{ fontSize: 14 }} />,
  },

  // Transaction statuses
  pending: {
    label: 'En attente',
    bg: '#FFFBEB',
    color: '#D97706',
    borderColor: '#FDE68A',
    icon: <HourglassEmpty sx={{ fontSize: 14 }} />,
  },
  completed: {
    label: 'Complete',
    bg: '#F0FDF4',
    color: '#16A34A',
    borderColor: '#BBF7D0',
    icon: <CheckCircle sx={{ fontSize: 14 }} />,
  },
  failed: {
    label: 'Echoue',
    bg: '#FEF2F2',
    color: '#DC2626',
    borderColor: '#FECACA',
    icon: <Error sx={{ fontSize: 14 }} />,
  },
  refunded: {
    label: 'Rembourse',
    bg: '#F5F3FF',
    color: '#7C3AED',
    borderColor: '#DDD6FE',
    icon: <Info sx={{ fontSize: 14 }} />,
  },

  // KYC statuses
  approved: {
    label: 'Approuve',
    bg: '#F0FDF4',
    color: '#16A34A',
    borderColor: '#BBF7D0',
    icon: <Done sx={{ fontSize: 14 }} />,
  },
  rejected: {
    label: 'Rejete',
    bg: '#FEF2F2',
    color: '#DC2626',
    borderColor: '#FECACA',
    icon: <Cancel sx={{ fontSize: 14 }} />,
  },

  // Tontine statuses
  cancelled: {
    label: 'Annule',
    bg: '#FEF2F2',
    color: '#DC2626',
    borderColor: '#FECACA',
    icon: <Cancel sx={{ fontSize: 14 }} />,
  },

  // Ticket statuses
  open: {
    label: 'Ouvert',
    bg: '#EFF6FF',
    color: '#2563EB',
    borderColor: '#BFDBFE',
    icon: <Info sx={{ fontSize: 14 }} />,
  },
  in_progress: {
    label: 'En cours',
    bg: '#FFFBEB',
    color: '#D97706',
    borderColor: '#FDE68A',
    icon: <HourglassEmpty sx={{ fontSize: 14 }} />,
  },
  resolved: {
    label: 'Resolu',
    bg: '#F0FDF4',
    color: '#16A34A',
    borderColor: '#BBF7D0',
    icon: <CheckCircle sx={{ fontSize: 14 }} />,
  },

  // Saga states
  INITIATED: {
    label: 'Initie',
    bg: '#F8FAFC',
    color: '#64748B',
    borderColor: '#E2E8F0',
    icon: <Info sx={{ fontSize: 14 }} />,
  },
  VALIDATED: {
    label: 'Valide',
    bg: '#EFF6FF',
    color: '#2563EB',
    borderColor: '#BFDBFE',
    icon: <CheckCircle sx={{ fontSize: 14 }} />,
  },
  RESERVED: {
    label: 'Reserve',
    bg: '#FFFBEB',
    color: '#D97706',
    borderColor: '#FDE68A',
    icon: <Lock sx={{ fontSize: 14 }} />,
  },
  EXECUTED: {
    label: 'Execute',
    bg: '#F5F3FF',
    color: '#7C3AED',
    borderColor: '#DDD6FE',
    icon: <Done sx={{ fontSize: 14 }} />,
  },
  COMPLETED: {
    label: 'Termine',
    bg: '#F0FDF4',
    color: '#16A34A',
    borderColor: '#BBF7D0',
    icon: <CheckCircle sx={{ fontSize: 14 }} />,
  },
  ROLLED_BACK: {
    label: 'Annule',
    bg: '#FEF2F2',
    color: '#DC2626',
    borderColor: '#FECACA',
    icon: <Cancel sx={{ fontSize: 14 }} />,
  },
}

interface StatusChipProps {
  status: string
  size?: 'small' | 'medium'
}

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const config = statusConfigs[status] || {
    label: status,
    bg: '#F8FAFC',
    color: '#64748B',
    borderColor: '#E2E8F0',
  }

  return (
    <Chip
      label={config.label}
      size={size}
      icon={config.icon}
      sx={{
        fontWeight: 600,
        fontSize: 11.5,
        borderRadius: 2,
        height: size === 'small' ? 26 : 30,
        bgcolor: config.bg,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
        '& .MuiChip-icon': {
          color: config.color,
          ml: 0.5,
        },
        '& .MuiChip-label': {
          px: 1,
        },
      }}
    />
  )
}

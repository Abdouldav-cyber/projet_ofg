import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#7C3AED',
      light: '#A78BFA',
      dark: '#5B21B6',
      contrastText: '#fff',
    },
    secondary: {
      main: '#10B981',
      light: '#6EE7B7',
      dark: '#059669',
      contrastText: '#fff',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    info: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.25rem', fontWeight: 700, color: '#1E293B', lineHeight: 1.2 },
    h2: { fontSize: '1.875rem', fontWeight: 700, color: '#1E293B', lineHeight: 1.3 },
    h3: { fontSize: '1.5rem', fontWeight: 600, color: '#1E293B', lineHeight: 1.3 },
    h4: { fontSize: '1.25rem', fontWeight: 600, color: '#1E293B', lineHeight: 1.4 },
    h5: { fontSize: '1.125rem', fontWeight: 600, color: '#1E293B', lineHeight: 1.4 },
    h6: { fontSize: '1rem', fontWeight: 600, color: '#1E293B', lineHeight: 1.5 },
    button: { fontWeight: 500, textTransform: 'none' },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.04)',
    '0px 2px 6px rgba(0, 0, 0, 0.04)',
    '0px 4px 12px rgba(0, 0, 0, 0.05)',
    '0px 6px 16px rgba(0, 0, 0, 0.06)',
    '0px 8px 20px rgba(0, 0, 0, 0.07)',
    '0px 10px 24px rgba(0, 0, 0, 0.08)',
    '0px 12px 28px rgba(0, 0, 0, 0.09)',
    '0px 14px 32px rgba(0, 0, 0, 0.10)',
    '0px 16px 36px rgba(0, 0, 0, 0.11)',
    '0px 18px 40px rgba(0, 0, 0, 0.12)',
    '0px 20px 44px rgba(0, 0, 0, 0.13)',
    '0px 22px 48px rgba(0, 0, 0, 0.14)',
    '0px 24px 52px rgba(0, 0, 0, 0.15)',
    '0px 26px 56px rgba(0, 0, 0, 0.16)',
    '0px 28px 60px rgba(0, 0, 0, 0.17)',
    '0px 30px 64px rgba(0, 0, 0, 0.18)',
    '0px 32px 68px rgba(0, 0, 0, 0.19)',
    '0px 34px 72px rgba(0, 0, 0, 0.20)',
    '0px 36px 76px rgba(0, 0, 0, 0.21)',
    '0px 38px 80px rgba(0, 0, 0, 0.22)',
    '0px 40px 84px rgba(0, 0, 0, 0.23)',
    '0px 42px 88px rgba(0, 0, 0, 0.24)',
    '0px 44px 92px rgba(0, 0, 0, 0.25)',
    '0px 46px 96px rgba(0, 0, 0, 0.26)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10,
          fontWeight: 500,
          padding: '8px 20px',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        contained: {
          '&.MuiButton-containedPrimary': {
            background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
            color: '#FFFFFF',
            '&:hover': {
              background: 'linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%)',
            },
          },
        },
        outlined: {
          borderWidth: 1,
          borderColor: '#E2E8F0',
          color: '#475569',
          '&:hover': {
            borderWidth: 1,
            borderColor: '#CBD5E1',
            background: '#F8FAFC',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.04)',
          border: '1px solid #E2E8F0',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.06)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#F8FAFC',
          color: '#475569',
          borderBottom: '1px solid #E2E8F0',
          fontSize: 13,
        },
        root: {
          borderBottom: '1px solid #F1F5F9',
          fontSize: 13.5,
          py: 12,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#F8FAFC',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '& fieldset': {
              borderColor: '#E2E8F0',
            },
            '&:hover fieldset': {
              borderColor: '#A78BFA',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#7C3AED',
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #E2E8F0',
          background: '#FFFFFF',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid #E2E8F0',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '&.Mui-selected': {
            '&:hover': {
              backgroundColor: 'rgba(124, 58, 237, 0.08)',
            },
          },
          '&:hover': {
            backgroundColor: '#F1F5F9',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#F1F5F9',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0px 20px 60px rgba(0, 0, 0, 0.12)',
        },
      },
    },
  },
})

export default theme

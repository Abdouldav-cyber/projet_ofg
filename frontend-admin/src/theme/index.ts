import { createTheme, Theme } from '@mui/material/styles'

export function getTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
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
        default: isDark ? '#0F172A' : '#F8FAFC',
        paper: isDark ? '#1E293B' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#F8FAFC' : '#1E293B',
        secondary: isDark ? '#94A3B8' : '#64748B',
      },
      divider: isDark ? '#334155' : '#E2E8F0',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2 },
      h2: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.3 },
      h3: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 },
      h4: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
      h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
      h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
      button: { fontWeight: 500, textTransform: 'none' },
    },
    shape: {
      borderRadius: 12,
    },
    shadows: [
      'none',
      isDark ? '0px 1px 3px rgba(0, 0, 0, 0.4)' : '0px 1px 3px rgba(0, 0, 0, 0.04)',
      isDark ? '0px 2px 6px rgba(0, 0, 0, 0.4)' : '0px 2px 6px rgba(0, 0, 0, 0.04)',
      'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none',
      'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none'
    ] as any, // Simplified shadows for code size,
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
            borderColor: isDark ? '#334155' : '#E2E8F0',
            color: isDark ? '#CBD5E1' : '#475569',
            '&:hover': {
              borderWidth: 1,
              borderColor: isDark ? '#475569' : '#CBD5E1',
              background: isDark ? '#0F172A' : '#F8FAFC',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: isDark ? '0px 1px 3px rgba(0,0,0,0.4)' : '0px 1px 3px rgba(0, 0, 0, 0.04)',
            border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            transition: 'all 0.2s ease',
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            '&:hover': {
              boxShadow: isDark ? '0px 4px 12px rgba(0,0,0,0.6)' : '0px 4px 12px rgba(0, 0, 0, 0.06)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
            color: isDark ? '#CBD5E1' : '#475569',
            borderBottom: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            fontSize: 13,
          },
          root: {
            borderBottom: `1px solid ${isDark ? '#1E293B' : '#F1F5F9'}`,
            fontSize: 13.5,
            py: 1.5,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              '& fieldset': {
                borderColor: isDark ? '#334155' : '#E2E8F0',
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
            borderRight: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
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
              backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
            },
          },
        },
      },
    },
  })
}

// For backwards compatibility where `theme` was imported directly
export default getTheme('light')

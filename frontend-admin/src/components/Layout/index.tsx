import { ReactNode, useState } from 'react'
import { Box, Toolbar, useTheme, useMediaQuery } from '@mui/material'
import Sidebar from './Sidebar'
import Header from './Header'
import { SIDEBAR_WIDTH } from './constants'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <Header onToggleSidebar={handleToggleSidebar} sidebarOpen={sidebarOpen} />

      <Box
        component="main"
        sx={{
          px: { xs: 2, sm: 3, md: 3 },
          pb: 3,
          minHeight: '100vh',
          ml: {
            xs: 0,
            md: sidebarOpen ? `${SIDEBAR_WIDTH}px` : 0,
          },
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
        {/* Spacer invisible qui prend exactement la hauteur du header */}
        <Toolbar sx={{ height: 70, minHeight: 70 }} />
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}

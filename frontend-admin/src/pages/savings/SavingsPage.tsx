import { useState } from 'react'
import {
  Box,
  Typography,
  LinearProgress,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'
import { format } from 'date-fns'

export default function SavingsPage() {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  // Queries
  const { data: savingsData, isLoading } = useQuery({
    queryKey: ['savings-goals', page, pageSize],
    queryFn: () => apiService.getAdminSavings({
      page: page + 1,
      page_size: pageSize
    }),
  })

  const columns: Column<any>[] = [
    {
      id: 'name',
      label: 'Objectif',
      render: (row: any) => <strong>{row.name}</strong>
    },
    {
      id: 'current_amount',
      label: 'Mis de côté',
      render: (row: any) => <Typography color="success.main" fontWeight="bold">{Number(row.current_amount).toLocaleString()} XOF</Typography>
    },
    {
      id: 'target_amount',
      label: 'Cible',
      render: (row: any) => `${Number(row.target_amount).toLocaleString()} XOF`
    },
    {
      id: 'progress_percentage',
      label: 'Progression',
      render: (row: any) => (
        <Box sx={{ width: '100%', mr: 1, display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: '100%', mr: 1 }}>
            <LinearProgress variant="determinate" value={Number(row.progress_percentage)} sx={{ height: 8, borderRadius: 5 }} />
          </Box>
          <Box sx={{ minWidth: 35 }}>
            <Typography variant="body2" color="text.secondary">{`${Math.round(Number(row.progress_percentage))}%`}</Typography>
          </Box>
        </Box>
      )
    },
    {
      id: 'deadline',
      label: 'Date Butoir',
      render: (row: any) => row.deadline ? format(new Date(row.deadline), 'dd/MM/yyyy') : 'Aucune'
    },
    {
      id: 'status',
      label: 'Statut',
      render: (row: any) => <StatusChip status={row.status as any} />
    }
  ]

  const items = Array.isArray(savingsData) ? savingsData : (savingsData?.items || [])
  const total = savingsData?.total || items.length

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Épargne Utilisateurs
        </Typography>
      </Box>

      <DataTable
        columns={columns}
        data={items}
        totalCount={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        loading={isLoading}
        rowKey={(row) => row.id}
      />
    </Box>
  )
}

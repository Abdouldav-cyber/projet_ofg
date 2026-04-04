import { useState } from 'react'
import {
  Box,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import apiService from '@/services/api'
import DataTable, { Column } from '@/components/common/DataTable'
import StatusChip from '@/components/common/StatusChip'

export default function CirclePage() {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  // Queries
  const { data: circleData, isLoading } = useQuery({
    queryKey: ['circle', page, pageSize],
    queryFn: () => apiService.getAdminCircle({
      page: page + 1,
      page_size: pageSize
    }),
  })

  const columns: Column<any>[] = [
    {
      id: 'user_email',
      label: 'Utilisateur Moteur',
      render: (row: any) => <strong>{row.user_email}</strong>
    },
    {
      id: 'contact',
      label: 'Contact (Ami/Filleul)',
      render: (row: any) => `${row.contact_first_name || ''} ${row.contact_last_name || ''}`
    },
    {
      id: 'is_favorite',
      label: 'Favori ?',
      render: (row: any) => row.is_favorite ? '⭐ Oui' : 'Non'
    },
    {
      id: 'status',
      label: 'Statut du Lien',
      render: (row: any) => <StatusChip status={row.status as any} />
    }
  ]

  const items = Array.isArray(circleData) ? circleData : (circleData?.items || [])
  const total = circleData?.total || items.length

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Réseau Social (Djembé Circle)
        </Typography>
      </Box>

      <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
        Suivez ici les connexions sociales entre vos utilisateurs (Parrainages, ajouts d'amis).
      </Typography>

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

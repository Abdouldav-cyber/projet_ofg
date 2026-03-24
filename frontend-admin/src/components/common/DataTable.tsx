import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Box,
  CircularProgress,
  Typography,
} from '@mui/material'
import { Inbox } from '@mui/icons-material'
import { useState } from 'react'

export interface Column<T> {
  id: string
  label: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  minWidth?: number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  totalCount?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  rowKey: (row: T) => string | number
}

export default function DataTable<T>({
  columns,
  data,
  loading = false,
  totalCount,
  page = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  rowKey,
}: DataTableProps<T>) {
  const [orderBy, setOrderBy] = useState<string>('')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')

  const handleSort = (columnId: string) => {
    const isAsc = orderBy === columnId && order === 'asc'
    const newOrder = isAsc ? 'desc' : 'asc'
    setOrder(newOrder)
    setOrderBy(columnId)

    if (onSortChange) {
      onSortChange(columnId, newOrder)
    }
  }

  const handleChangePage = (_event: unknown, newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage)
    }
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPageSize = parseInt(event.target.value, 10)
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize)
    }
    if (onPageChange) {
      onPageChange(0)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={36} sx={{ color: '#7C3AED' }} />
      </Box>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Paper
        sx={{
          p: 6,
          textAlign: 'center',
          border: '1px solid #E2E8F0',
          boxShadow: 'none',
          borderRadius: 3,
        }}
      >
        <Inbox sx={{ fontSize: 48, color: '#CBD5E1', mb: 1.5 }} />
        <Typography sx={{ fontSize: 15, color: '#64748B', fontWeight: 500 }}>
          Aucune donnee disponible
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper
      sx={{
        width: '100%',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        boxShadow: 'none',
        borderRadius: 3,
      }}
    >
      <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  style={{ minWidth: column.minWidth }}
                  sortDirection={orderBy === column.id ? order : false}
                  sx={{
                    bgcolor: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: 13,
                    py: 1.5,
                  }}
                >
                  {column.sortable ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow
                hover
                key={rowKey(row)}
                sx={{
                  '&:hover': { bgcolor: '#F8FAFC' },
                  '& td': {
                    borderBottom: '1px solid #F1F5F9',
                    fontSize: 13.5,
                    py: 1.5,
                  },
                }}
              >
                {columns.map((column) => (
                  <TableCell key={column.id} align={column.align || 'left'}>
                    {column.render ? column.render(row) : (row as any)[column.id]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {totalCount !== undefined && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={pageSize}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Lignes par page:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
          sx={{
            borderTop: '1px solid #E2E8F0',
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontSize: 13,
              color: '#64748B',
            },
          }}
        />
      )}
    </Paper>
  )
}

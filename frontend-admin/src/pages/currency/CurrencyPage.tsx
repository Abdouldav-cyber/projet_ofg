import { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { CurrencyExchange, SwapHoriz } from '@mui/icons-material'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import apiService from '@/services/api'

const CURRENCIES = [
  { code: 'XOF', label: 'XOF - Franc CFA (BCEAO)' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'USD', label: 'USD - Dollar US' },
  { code: 'NGN', label: 'NGN - Naira Nigerian' },
  { code: 'GHS', label: 'GHS - Cedi Ghaneen' },
  { code: 'GBP', label: 'GBP - Livre Sterling' },
]

export default function CurrencyPage() {
  const { enqueueSnackbar } = useSnackbar()

  const [amount, setAmount] = useState('100000')
  const [fromCurrency, setFromCurrency] = useState('XOF')
  const [toCurrency, setToCurrency] = useState('EUR')

  // Taux de change
  const { data: rates, isLoading: ratesLoading } = useQuery({
    queryKey: ['exchangeRates', fromCurrency],
    queryFn: () => apiService.getExchangeRates(fromCurrency),
    refetchInterval: 300000, // 5 min
  })

  // Conversion
  const convertMutation = useMutation({
    mutationFn: () => apiService.convertCurrency(
      parseFloat(amount),
      fromCurrency,
      toCurrency
    ),
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.detail || 'Erreur de conversion', { variant: 'error' })
    },
  })

  const formatCurrency = (value: number, decimals = 2) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }

  const handleSwap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
    convertMutation.reset()
  }

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h3">Conversion de devises</Typography>
        <Typography sx={{ fontSize: 14, color: '#64748B', mt: 0.5 }}>
          Consultez les taux de change et effectuez des conversions
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Convertisseur */}
        <Grid item xs={12} lg={7}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <CurrencyExchange sx={{ color: '#F59E0B' }} />
                <Typography variant="h6" fontWeight={600} sx={{ color: '#1E293B' }}>
                  Convertisseur
                </Typography>
              </Box>

              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    label="Montant"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <FormControl fullWidth>
                    <InputLabel>De</InputLabel>
                    <Select
                      value={fromCurrency}
                      label="De"
                      onChange={(e) => { setFromCurrency(e.target.value); convertMutation.reset() }}
                    >
                      {CURRENCIES.map(c => (
                        <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={2} sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    onClick={handleSwap}
                    sx={{
                      minWidth: 48,
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: '#F1F5F9',
                      color: '#64748B',
                      '&:hover': { bgcolor: '#E2E8F0' },
                    }}
                  >
                    <SwapHoriz />
                  </Button>
                </Grid>

                <Grid item xs={12} sm={5}>
                  {convertMutation.data ? (
                    <Box sx={{ mb: 2, p: 2, bgcolor: '#F0FDF4', borderRadius: 2, border: '1px solid #BBF7D0' }}>
                      <Typography variant="caption" color="text.secondary">Resultat</Typography>
                      <Typography variant="h5" fontWeight={700} sx={{ color: '#16A34A' }}>
                        {formatCurrency(convertMutation.data.converted_amount || convertMutation.data.result || 0)} {toCurrency}
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ mb: 2, height: 72 }} />
                  )}
                  <FormControl fullWidth>
                    <InputLabel>Vers</InputLabel>
                    <Select
                      value={toCurrency}
                      label="Vers"
                      onChange={(e) => { setToCurrency(e.target.value); convertMutation.reset() }}
                    >
                      {CURRENCIES.map(c => (
                        <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Button
                fullWidth
                variant="contained"
                onClick={() => convertMutation.mutate()}
                disabled={!amount || fromCurrency === toCurrency || convertMutation.isPending}
                sx={{
                  mt: 3,
                  bgcolor: '#7C3AED',
                  '&:hover': { bgcolor: '#6D28D9' },
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1.5,
                }}
              >
                {convertMutation.isPending ? 'Conversion...' : 'Convertir'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Taux de change */}
        <Grid item xs={12} lg={5}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ color: '#1E293B', mb: 1 }}>
                Taux de change
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                Base: 1 {fromCurrency}
              </Typography>

              <Divider sx={{ my: 2 }} />

              {ratesLoading ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={32} sx={{ color: '#7C3AED' }} />
                </Box>
              ) : rates?.rates ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, color: '#64748B' }}>Devise</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: '#64748B' }}>Taux</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(rates.rates as Record<string, number>).map(([code, rate]) => (
                        <TableRow key={code} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>{code}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {formatCurrency(rate, 6)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Aucun taux disponible
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

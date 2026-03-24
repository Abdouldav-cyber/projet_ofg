import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  CircularProgress,
} from '@mui/material'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  loading?: boolean
  severity?: 'info' | 'warning' | 'error'
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  onConfirm,
  onCancel,
  loading = false,
  severity = 'info',
}: ConfirmDialogProps) {
  const getConfirmColor = () => {
    switch (severity) {
      case 'error':
        return 'error'
      case 'warning':
        return 'warning'
      default:
        return 'primary'
    }
  }

  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          color={getConfirmColor()}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

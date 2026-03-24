import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Chip,
  CircularProgress,
} from '@mui/material'
import {
  Send,
  Close,
  SupportAgent,
  Person,
  Circle,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { useAuth } from '@/contexts/AuthContext'
import apiService from '@/services/api'
import { ChatMessage, SupportTicket } from '@/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface ChatWindowProps {
  ticket: SupportTicket
  onClose: () => void
}

export default function ChatWindow({ ticket, onClose }: ChatWindowProps) {
  const { user } = useAuth()
  const { subscribe } = useWebSocket()
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()
  const [newMessage, setNewMessage] = useState('')
  const [isTyping, setIsTyping] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Charger les messages
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ['chat-messages', ticket.id],
    queryFn: () => apiService.getChatMessages(ticket.id),
    refetchInterval: 10000, // Fallback polling toutes les 10s
  })

  // Envoyer un message
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) =>
      apiService.sendChatMessage(ticket.id, { message }),
    onSuccess: (newMsg) => {
      queryClient.setQueryData<ChatMessage[]>(['chat-messages', ticket.id], (old = []) => [
        ...old,
        newMsg,
      ])
      setNewMessage('')
    },
    onError: () => {
      enqueueSnackbar('Erreur lors de l\'envoi du message', { variant: 'error' })
    },
  })

  // Marquer comme lu
  useEffect(() => {
    if (ticket.id) {
      apiService.markMessagesRead(ticket.id).catch(() => {})
    }
  }, [ticket.id, messages.length])

  // Ecouter les messages WebSocket
  useEffect(() => {
    const unsubscribeMessage = subscribe('chat.message', (data: any) => {
      if (data.ticket_id === ticket.id) {
        // Ajouter le nouveau message
        queryClient.setQueryData<ChatMessage[]>(['chat-messages', ticket.id], (old = []) => {
          // Eviter les doublons
          if (old.some(m => m.id === data.message_id)) return old
          return [
            ...old,
            {
              id: data.message_id,
              ticket_id: data.ticket_id,
              sender_id: data.sender_id,
              sender_role: data.sender_role,
              sender_name: data.sender_name,
              message: data.message,
              message_type: data.message_type || 'text',
              is_read: false,
              created_at: data.timestamp || new Date().toISOString(),
            } as ChatMessage,
          ]
        })
        // Marquer comme lu
        apiService.markMessagesRead(ticket.id).catch(() => {})
      }
    })

    const unsubscribeTyping = subscribe('chat.typing', (data: any) => {
      if (data.ticket_id === ticket.id && data.user_id !== user?.id) {
        setIsTyping(data.user_name)
        // Cacher l'indicateur apres 3s
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setIsTyping(null), 3000)
      }
    })

    return () => {
      unsubscribeMessage()
      unsubscribeTyping()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [ticket.id, subscribe, queryClient, user?.id])

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const trimmed = newMessage.trim()
    if (!trimmed) return
    sendMessageMutation.mutate(trimmed)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Indicateur de frappe (debounced)
  const handleTyping = useCallback(() => {
    apiService.sendTypingIndicator(ticket.id).catch(() => {})
  }, [ticket.id])

  const isOwnMessage = (msg: ChatMessage) => msg.sender_id === user?.id

  const getSenderAvatar = (msg: ChatMessage) => {
    if (msg.sender_role === 'customer') {
      return <Person sx={{ fontSize: 18 }} />
    }
    return <SupportAgent sx={{ fontSize: 18 }} />
  }

  const getSenderColor = (msg: ChatMessage) => {
    if (msg.sender_role === 'customer') return '#6B7280'
    if (msg.sender_role === 'support_l2') return '#7C3AED'
    return '#2563EB'
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: 600,
        border: '1px solid #E5E7EB',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: '#FFFFFF',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E5E7EB',
          bgcolor: '#F9FAFB',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <SupportAgent sx={{ color: '#2563EB', fontSize: 20 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#1F2937' }}>
              Chat - #{ticket.id.substring(0, 8)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ticket.subject}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            label={ticket.status === 'open' ? 'Ouvert' : ticket.status === 'in_progress' ? 'En cours' : ticket.status}
            size="small"
            color={ticket.status === 'open' ? 'warning' : ticket.status === 'in_progress' ? 'info' : 'default'}
          />
          <IconButton size="small" onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Messages area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          bgcolor: '#FAFAFA',
          minHeight: 300,
        }}
      >
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
            <CircularProgress size={30} />
          </Box>
        ) : messages.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
            <Typography variant="body2" color="text.secondary">
              Aucun message. Commencez la conversation !
            </Typography>
          </Box>
        ) : (
          messages.map((msg) => {
            const own = isOwnMessage(msg)
            return (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  flexDirection: own ? 'row-reverse' : 'row',
                  gap: 1,
                  alignItems: 'flex-end',
                }}
              >
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: own ? '#2563EB' : getSenderColor(msg),
                    fontSize: 14,
                  }}
                >
                  {getSenderAvatar(msg)}
                </Avatar>
                <Box
                  sx={{
                    maxWidth: '70%',
                    px: 2,
                    py: 1,
                    borderRadius: own
                      ? '12px 12px 2px 12px'
                      : '12px 12px 12px 2px',
                    bgcolor: own ? '#2563EB' : '#FFFFFF',
                    color: own ? '#FFFFFF' : '#1F2937',
                    border: own ? 'none' : '1px solid #E5E7EB',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {!own && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: getSenderColor(msg),
                        display: 'block',
                        mb: 0.3,
                      }}
                    >
                      {msg.sender_name || 'Agent'}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.message}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      textAlign: 'right',
                      mt: 0.5,
                      opacity: 0.7,
                      fontSize: '0.65rem',
                      color: own ? 'rgba(255,255,255,0.7)' : '#9CA3AF',
                    }}
                  >
                    {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                  </Typography>
                </Box>
              </Box>
            )
          })
        )}

        {/* Indicateur de frappe */}
        {isTyping && (
          <Box display="flex" alignItems="center" gap={1} px={1}>
            <Circle sx={{ fontSize: 8, color: '#10B981', animation: 'pulse 1.5s infinite' }} />
            <Typography variant="caption" color="text.secondary" fontStyle="italic">
              {isTyping} est en train d'ecrire...
            </Typography>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input area */}
      <Box
        sx={{
          p: 1.5,
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          gap: 1,
          bgcolor: '#FFFFFF',
        }}
      >
        <TextField
          fullWidth
          placeholder="Tapez votre message..."
          size="small"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value)
            handleTyping()
          }}
          onKeyDown={handleKeyPress}
          multiline
          maxRows={3}
          disabled={ticket.status === 'closed' || sendMessageMutation.isPending}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              bgcolor: '#F9FAFB',
            },
          }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!newMessage.trim() || sendMessageMutation.isPending || ticket.status === 'closed'}
          sx={{
            bgcolor: '#2563EB',
            color: '#FFFFFF',
            '&:hover': { bgcolor: '#1D4ED8' },
            '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
            borderRadius: 2,
            width: 40,
            height: 40,
            alignSelf: 'flex-end',
          }}
        >
          {sendMessageMutation.isPending ? (
            <CircularProgress size={18} sx={{ color: '#FFFFFF' }} />
          ) : (
            <Send fontSize="small" />
          )}
        </IconButton>
      </Box>
    </Box>
  )
}

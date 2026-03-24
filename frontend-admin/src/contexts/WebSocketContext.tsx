import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useSnackbar } from 'notistack'
import { WebSocketMessage } from '@/types'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

interface WebSocketContextType {
  isConnected: boolean
  sendMessage: (message: any) => void
  subscribe: (type: string, callback: (data: any) => void) => () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [subscribers, setSubscribers] = useState<Map<string, Set<(data: any) => void>>>(new Map())
  const { enqueueSnackbar } = useSnackbar()

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const websocket = new WebSocket(`${WS_URL}?token=${token}`)

    websocket.onopen = () => {
      console.log('WebSocket connecté')
      setIsConnected(true)
    }

    websocket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)

        // Notifier les abonnés
        const callbacks = subscribers.get(message.type)
        if (callbacks) {
          callbacks.forEach(callback => callback(message.data))
        }

        // Afficher les notifications
        if (message.type === 'notification.new') {
          enqueueSnackbar(message.data.message, {
            variant: message.data.type || 'info',
            autoHideDuration: 5000,
          })
        }
      } catch (error) {
        console.error('Erreur de parsing WebSocket:', error)
      }
    }

    websocket.onerror = (error) => {
      console.error('Erreur WebSocket:', error)
      setIsConnected(false)
    }

    websocket.onclose = () => {
      console.log('WebSocket déconnecté')
      setIsConnected(false)

      // Tentative de reconnexion après 5 secondes
      setTimeout(() => {
        const token = localStorage.getItem('access_token')
        if (token) {
          connect()
        }
      }, 5000)
    }

    setWs(websocket)

    return websocket
  }, [subscribers, enqueueSnackbar])

  useEffect(() => {
    const websocket = connect()

    return () => {
      if (websocket) {
        websocket.close()
      }
    }
  }, [connect])

  const sendMessage = useCallback((message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }, [ws])

  const subscribe = useCallback((type: string, callback: (data: any) => void) => {
    setSubscribers(prev => {
      const newSubscribers = new Map(prev)
      if (!newSubscribers.has(type)) {
        newSubscribers.set(type, new Set())
      }
      newSubscribers.get(type)!.add(callback)
      return newSubscribers
    })

    // Retourner une fonction de désabonnement
    return () => {
      setSubscribers(prev => {
        const newSubscribers = new Map(prev)
        const callbacks = newSubscribers.get(type)
        if (callbacks) {
          callbacks.delete(callback)
          if (callbacks.size === 0) {
            newSubscribers.delete(type)
          }
        }
        return newSubscribers
      })
    }
  }, [])

  const value = {
    isConnected,
    sendMessage,
    subscribe,
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket doit être utilisé à l\'intérieur d\'un WebSocketProvider')
  }
  return context
}

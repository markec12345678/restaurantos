// ============================================
// TIPI za WebSocket odjemalca
// ============================================

export interface WSMessage {
  type: string
  payload: unknown
  timestamp: string
}

export type WSEventType =
  | 'NEW_ORDER'
  | 'ORDER_UPDATED'
  | 'ITEM_STATUS_CHANGED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FIRED'
  | 'ORDER_READY'
  | 'STOCK_LOW'
  | 'STOCK_OUT'
  | 'CONNECTED'
  | 'SERVER_SHUTDOWN'
  | 'AUTH_SUCCESS'
  | 'AUTH_REQUIRED'

export interface UseKitchenWebSocketOptions {
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean
  /** Max reconnection attempts before giving up (default: 10) */
  maxReconnectAttempts?: number
  /** Called when a specific event is received */
  onEvent?: (_message: WSMessage) => void
  /** FIX CRITICAL: Bearer token za WS avtentikacijo */
  token?: string | null
}

export interface UseKitchenWebSocketReturn {
  /** Whether the WebSocket is currently connected */
  connected: boolean
  /** The last event received from the WebSocket */
  lastEvent: WSMessage | null
  /** Manually reconnect the WebSocket */
  reconnect: () => void
  /** Send a message through the WebSocket */
  send: (_type: string, _payload: unknown) => void
}

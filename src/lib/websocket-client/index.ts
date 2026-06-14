// Barrel re-export za backward compatibility
// Vsi uvozi `@/lib/websocket-client` še naprej delujejo

export type { WSMessage, WSEventType, UseKitchenWebSocketOptions, UseKitchenWebSocketReturn } from './types'
export { broadcastWSEvent } from './broadcast'
export { useKitchenWebSocket } from './use-kitchen-websocket'

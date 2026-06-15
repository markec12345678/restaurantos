// Tipi in konfiguracija za kartične terminale

export type TerminalProvider = 'nexgo' | 'pax' | 'verifone' | 'ingenico' | 'sumup' | 'square' | 'test'

export interface TerminalConfig {
  provider: TerminalProvider
  ipAddress: string
  port: number
  apiKey?: string
  terminalId?: string
  merchantId?: string
}

export interface PaymentRequest {
  amount: number
  currency: string
  orderId: string
  orderNumber: number
  tipAmount?: number
  paymentType: 'sale' | 'refund' | 'void' | 'preauth' | 'capture'
  referenceId?: string
}

export interface TerminalResponse {
  success: boolean
  transactionId?: string
  authorizationCode?: string
  cardType?: string
  cardLast4?: string
  receiptData?: string
  error?: string
  provider: TerminalProvider
  timestamp: string
}

// FIX HIGH: XML escape funkcija — prepreči XML injection v PAX integraciji
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function mapPaymentType(type: string): string {
  const map: Record<string, string> = { sale: 'SALE', refund: 'REFUND', void: 'VOID', preauth: 'PREAUTH', capture: 'CAPTURE' }
  return map[type] || 'SALE'
}

export function getTerminalConfig(settings: { registerNumber: string; businessId: string } | null): TerminalConfig {
  // FIX HIGH: Preberi provider iz settings namesto hardcode 'test'
  const provider = (process.env.TERMINAL_PROVIDER as TerminalProvider) || 'test'
  return {
    provider,
    ipAddress: process.env.TERMINAL_IP || '',
    port: parseInt(process.env.TERMINAL_PORT || '5015'),
    terminalId: settings?.registerNumber || 'BLG-001',
    merchantId: settings?.businessId || '',
    apiKey: process.env.TERMINAL_API_KEY || undefined,
  }
}

export async function checkTerminalStatus(config: TerminalConfig): Promise<{
  connected: boolean
  responseTime?: number
  error?: string
}> {
  if (config.provider === 'test') {
    return { connected: true, responseTime: 0 }
  }
  if (!config.ipAddress) {
    return { connected: false, error: 'IP naslov terminala ni nastavljen' }
  }
  try {
    const start = Date.now()
    if (['nexgo', 'pax'].includes(config.provider)) {
      const response = await fetch(`http://${config.ipAddress}:${config.port}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      return { connected: response.ok, responseTime: Date.now() - start }
    }
    return { connected: true, responseTime: Date.now() - start }
  } catch (err: unknown) {
    return { connected: false, error: err instanceof Error ? err.message : 'Terminal ni dosegljiv' }
  }
}

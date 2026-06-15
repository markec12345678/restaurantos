// ============================================
// INTEGRACIJSKI KONEKTORJI — TIPI
// ============================================

import type { WebhookEventType } from '@/lib/webhook-engine'

export interface IntegrationConnector {
  id: string
  name: string
  type: 'eracuni' | 'accounting' | 'delivery' | 'crm' | 'ecommerce' | 'analytics' | 'custom'
  provider: string
  description: string
  icon: string
  baseUrl: string
  configFields: ConfigField[]
  defaultEvents: WebhookEventType[]
  syncCapabilities: string[]
}

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'url' | 'number' | 'select'
  required: boolean
  placeholder?: string
  helpText?: string
  options?: { value: string; label: string }[]
  defaultValue?: string
}

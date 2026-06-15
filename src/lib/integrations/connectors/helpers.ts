// ============================================
// INTEGRACIJSKI KONEKTORJI — POMOŽNE FUNKCIJE
// ============================================

import type { IntegrationConnector } from './types'
import { accountingConnectors } from './accounting'
import { deliveryConnectors, ecommerceConnectors, crmConnectors, analyticsConnectors, customConnectors } from './connectors'

export const INTEGRATION_CONNECTORS: IntegrationConnector[] = [
  ...accountingConnectors,
  ...deliveryConnectors,
  ...ecommerceConnectors,
  ...crmConnectors,
  ...analyticsConnectors,
  ...customConnectors,
]

/**
 * Pridobi konektor po ID-ju
 */
export function getConnector(connectorId: string): IntegrationConnector | undefined {
  return INTEGRATION_CONNECTORS.find(c => c.id === connectorId)
}

/**
 * Pridobi konektorje po tipu
 */
export function getConnectorsByType(type: string): IntegrationConnector[] {
  return INTEGRATION_CONNECTORS.filter(c => c.type === type)
}

/**
 * Pridobi vse tipe konektorjev
 */
export function getConnectorTypes(): { value: string; label: string }[] {
  return [
    { value: 'eracuni', label: 'e-Računi' },
    { value: 'accounting', label: 'Računovodstvo' },
    { value: 'delivery', label: 'Dostava' },
    { value: 'crm', label: 'CRM / Marketing' },
    { value: 'ecommerce', label: 'E-Commerce' },
    { value: 'analytics', label: 'Analitika' },
    { value: 'custom', label: 'Splošno / Webhook' },
  ]
}

// ============================================
// INTEGRACIJSKI KONEKTORJI
// Predpripravljeni konektorji za priljubljene slovenske/internacionalne servise
// ============================================

import type { WebhookEventType } from '@/lib/webhook-engine'

// ============================================
// TIPI
// ============================================

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

interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'url' | 'number' | 'select'
  required: boolean
  placeholder?: string
  helpText?: string
  options?: { value: string; label: string }[]
  defaultValue?: string
}

// ============================================
// KONEKTORJI
// ============================================

export const INTEGRATION_CONNECTORS: IntegrationConnector[] = [
  // --- e-Računi (Slovenija) ---
  {
    id: 'eracuni',
    name: 'e-Računi',
    type: 'eracuni',
    provider: 'eracuni',
    description: 'Samodejno pošiljanje računov v e-Račune (Ubl2.1 format). Podpira sinhronizacijo računov, dobavnic in predračunov z davčno potrjenimi računi iz RestaurantOS.',
    icon: '📄',
    baseUrl: 'https://www.e-racuni.com',
    configFields: [
      { key: 'companyId', label: 'ID podjetja', type: 'text', required: true, placeholder: '12345', helpText: 'ID podjetja v e-Računih' },
      { key: 'mapId', label: 'ID mape', type: 'text', required: false, placeholder: '67890', helpText: 'ID mape za račune (opcijsko)' },
      { key: 'autoSend', label: 'Samodejno pošiljanje', type: 'select', required: true, defaultValue: 'true', options: [
        { value: 'true', label: 'Da — pošlji ob plačilu' },
        { value: 'false', label: 'Ne — ročna sinhronizacija' },
      ]},
    ],
    defaultEvents: ['receipt.created', 'receipt.fiscal_verified', 'order.paid'],
    syncCapabilities: ['push_invoices', 'pull_payment_status', 'sync_customers'],
  },

  // --- Datalab (Slovenija — računovodstvo) ---
  {
    id: 'datalab-pantheon',
    name: 'Datalab Pantheon',
    type: 'accounting',
    provider: 'datalab',
    description: 'Integracija z Datalab Pantheon računovodskim programom. Samodejno knjiženje prometa, davčnih evidence in dnevnih poročil. Podpira Pantheon API v2.',
    icon: '📊',
    baseUrl: 'https://api.datalab.si',
    configFields: [
      { key: 'companyId', label: 'ID podjetja', type: 'text', required: true, placeholder: 'Datalab podjetje ID' },
      { key: 'departmentId', label: 'ID oddelka', type: 'text', required: false, placeholder: '1', helpText: 'Oddelková koda v Pantheonu' },
      { key: 'syncMode', label: 'Način sinhronizacije', type: 'select', required: true, defaultValue: 'daily', options: [
        { value: 'realtime', label: 'Realno-časovno (ob vsakem plačilu)' },
        { value: 'hourly', label: 'Vsako uro' },
        { value: 'daily', label: 'Dnevno (ob zaključku izmene)' },
      ]},
    ],
    defaultEvents: ['order.paid', 'cash_register.closed', 'daily_report.ready'],
    syncCapabilities: ['push_daily_report', 'push_invoices', 'sync_chart_of_accounts'],
  },

  // --- Spire ERP (Računovodstvo) ---
  {
    id: 'spire-erp',
    name: 'Spire ERP',
    type: 'accounting',
    provider: 'spire',
    description: 'Povezava s Spire ERP sistemom za samodejno knjiženje prodaje, upravljanje zalogo in finančno poročanje. Podpira Spire REST API.',
    icon: '📈',
    baseUrl: 'https://api.spireerp.com',
    configFields: [
      { key: 'companyId', label: 'ID podjetja', type: 'text', required: true },
      { key: 'warehouseId', label: 'ID skladišča', type: 'text', required: false },
      { key: 'syncInventory', label: 'Sinhroniziraj zalogo', type: 'select', required: true, defaultValue: 'true', options: [
        { value: 'true', label: 'Da — dvo-smerna sinhronizacija' },
        { value: 'false', label: 'Ne — samo pošiljanje prodaje' },
      ]},
    ],
    defaultEvents: ['order.paid', 'stock.low', 'stock.restocked', 'cash_register.closed'],
    syncCapabilities: ['push_sales', 'push_inventory', 'pull_inventory_levels', 'sync_products'],
  },

  // --- Wolt Dostava ---
  {
    id: 'wolt',
    name: 'Wolt Dostava',
    type: 'delivery',
    provider: 'wolt',
    description: 'Integracija z Wolt platformo za dostavo hrane. Samodejno posredovanje naročil, spremljanje statusa dostave in sinhronizacija menija. Podpira Wolt Merchant API.',
    icon: '🛵',
    baseUrl: 'https://daas.wolt.com',
    configFields: [
      { key: 'venueId', label: 'ID lokacije', type: 'text', required: true, placeholder: 'Wolt venue ID' },
      { key: 'autoAccept', label: 'Samodejno sprejemanje', type: 'select', required: true, defaultValue: 'true', options: [
        { value: 'true', label: 'Da — samodejno sprejmi naročila' },
        { value: 'false', label: 'Ne — ročno potrjevanje' },
      ]},
      { key: 'prepTimeMinutes', label: 'Čas priprave (min)', type: 'number', required: true, defaultValue: '25' },
    ],
    defaultEvents: ['order.created', 'order.ready', 'order.delivered'],
    syncCapabilities: ['push_orders', 'pull_delivery_status', 'sync_menu', 'sync_availability'],
  },

  // --- Glovo Dostava ---
  {
    id: 'glovo',
    name: 'Glovo Dostava',
    type: 'delivery',
    provider: 'glovo',
    description: 'Integracija z Glovo za dostavo naročil. Samodejno posredovanje naročil, ažuriranje statusa in upravljanje zaloge. Podpira Glovo Partners API.',
    icon: '🟡',
    baseUrl: 'https://api.glovoapp.com',
    configFields: [
      { key: 'storeId', label: 'ID trgovine', type: 'text', required: true, placeholder: 'Glovo store ID' },
      { key: 'autoAccept', label: 'Samodejno sprejemanje', type: 'select', required: true, defaultValue: 'true', options: [
        { value: 'true', label: 'Da' },
        { value: 'false', label: 'Ne' },
      ]},
    ],
    defaultEvents: ['order.created', 'order.ready', 'order.delivered'],
    syncCapabilities: ['push_orders', 'pull_delivery_status', 'sync_menu'],
  },

  // --- Shopify E-Commerce ---
  {
    id: 'shopify',
    name: 'Shopify',
    type: 'ecommerce',
    provider: 'shopify',
    description: 'Povezava s Shopify trgovino za spletno naročanje in dostavo. Sinhronizacija menija, zaloge in naročil med RestaurantOS in Shopify.',
    icon: '🛒',
    baseUrl: 'https://{shop}.myshopify.com/admin/api/2024-01',
    configFields: [
      { key: 'shopName', label: 'Ime trgovine', type: 'text', required: true, placeholder: 'moja-trgovina' },
      { key: 'locationId', label: 'ID lokacije', type: 'text', required: false },
    ],
    defaultEvents: ['order.created', 'order.paid', 'stock.low', 'stock.restocked'],
    syncCapabilities: ['push_products', 'pull_orders', 'sync_inventory', 'sync_menu'],
  },

  // --- Mailchimp CRM ---
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    type: 'crm',
    provider: 'mailchimp',
    description: 'Integracija z Mailchimp za e-poštni marketing. Samodejno dodajanje gostov v sezname, segmentacija po obiskih in pošiljanje ciljanih kampanj.',
    icon: '✉️',
    baseUrl: 'https://server.api.mailchimp.com/3.0',
    configFields: [
      { key: 'listId', label: 'ID seznama', type: 'text', required: true, placeholder: 'Mailchimp audience/list ID' },
      { key: 'serverPrefix', label: 'Strežniška oznaka', type: 'text', required: true, placeholder: 'us1', helpText: 'npr. us1, us19, itd.' },
      { key: 'tagNewCustomers', label: 'Oznaka za nove goste', type: 'text', required: false, defaultValue: 'Novi gostje' },
    ],
    defaultEvents: ['guest.created', 'loyalty.tier_upgraded'],
    syncCapabilities: ['push_contacts', 'sync_segments', 'trigger_campaigns'],
  },

  // --- Google Analytics ---
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    type: 'analytics',
    provider: 'google',
    description: 'Pošiljanje podatkov o prodaji in obnašanju gostov v Google Analytics 4. Sledenje konverzij, prometa po urah in učinkovitosti menija.',
    icon: '📊',
    baseUrl: 'https://www.google-analytics.com',
    configFields: [
      { key: 'measurementId', label: 'Measurement ID', type: 'text', required: true, placeholder: 'G-XXXXXXXXXX' },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
    ],
    defaultEvents: ['order.paid', 'order.created'],
    syncCapabilities: ['push_events', 'push_revenue_data'],
  },

  // --- Slack Obvestila ---
  {
    id: 'slack',
    name: 'Slack Obvestila',
    type: 'custom',
    provider: 'slack',
    description: 'Pošiljanje obvestil v Slack kanal. Obveščanje o novih naročilih, nizki zalogi, zaposlenih spremembah in dnevnih poročilih.',
    icon: '💬',
    baseUrl: 'https://hooks.slack.com/services',
    configFields: [
      { key: 'channel', label: 'Kanal', type: 'text', required: false, placeholder: '#restavracija', helpText: 'Privzeti kanal (lahko tudi webhook URL)' },
    ],
    defaultEvents: ['order.created', 'stock.low', 'stock.critical', 'cash_register.closed'],
    syncCapabilities: ['push_notifications'],
  },

  // --- Webhook (splošen) ---
  {
    id: 'custom-webhook',
    name: 'Splošen Webhook',
    type: 'custom',
    provider: 'custom',
    description: 'Splošen HTTP webhook za pošiljanje dogodkov na katerikoli URL. Podpira HMAC-SHA256 podpisovanje za varnost. Primeren za povezavo s poljubnimi sistemi.',
    icon: '🔗',
    baseUrl: '',
    configFields: [
      { key: 'customHeaders', label: 'Dodatne glave (JSON)', type: 'text', required: false, placeholder: '{"X-Custom-Header": "value"}' },
    ],
    defaultEvents: ['order.created', 'order.paid', 'stock.low'],
    syncCapabilities: ['push_events'],
  },
]

// ============================================
// POMOŽNE FUNKCIJE
// ============================================

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

// ============================================
// INTEGRACIJSKI KONEKTORJI — DOSTAVA & E-COMMERCE & CRM
// Wolt, Glovo, Shopify, Mailchimp, Google Analytics, Slack, Custom Webhook
// ============================================

import type { IntegrationConnector } from './types'

export const deliveryConnectors: IntegrationConnector[] = [
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
]

export const ecommerceConnectors: IntegrationConnector[] = [
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
]

export const crmConnectors: IntegrationConnector[] = [
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
]

export const analyticsConnectors: IntegrationConnector[] = [
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
]

export const customConnectors: IntegrationConnector[] = [
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

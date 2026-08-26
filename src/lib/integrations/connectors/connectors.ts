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

  // --- Deliverect (Uber Eats / DoorDash / Grubhub aggregator) ---
  // F6-4: EU standard za delivery aggregator
  {
    id: 'deliverect',
    name: 'Deliverect',
    type: 'delivery',
    provider: 'deliverect',
    description: 'Integracija z Deliverect platformo - agregator za Uber Eats, DoorDash, Grubhub, Deliveroo. Ena platforma za vse delivery kanale z avtomatsko sinhronizacijo menija, zaloge in naročil.',
    icon: 'T',
    baseUrl: 'https://api.deliverect.com',
    configFields: [
      { key: 'clientId', label: 'API Client ID', type: 'text', required: true, placeholder: 'Deliverect Client ID' },
      { key: 'clientSecret', label: 'API Client Secret', type: 'password', required: true },
      { key: 'locationId', label: 'Deliverect Location ID', type: 'text', required: true, placeholder: '0000000000000000' },
      { key: 'autoAccept', label: 'Samodejno sprejemanje', type: 'select', required: true, defaultValue: 'true', options: [
        { value: 'true', label: 'Da - samodejno sprejmi naročila' },
        { value: 'false', label: 'Ne - ročno potrjevanje' },
      ]},
    ],
    defaultEvents: ['order.created', 'order.ready', 'order.delivered', 'order.cancelled'],
    syncCapabilities: ['push_orders', 'pull_delivery_status', 'sync_menu', 'sync_availability', 'sync_all_channels'],
  },

  // --- Bolt Food Dostava ---
  {
    id: 'bolt',
    name: 'Bolt Food',
    type: 'delivery',
    provider: 'bolt',
    description: 'Integracija z Bolt Food za dostavo naročil. Samodejno sprejemanje naročil preko webhook-a, ažuriranje statusa in upravljanje zaloge. Priljubljena platforma v Sloveniji, Hrvaški in Baltskih državah.',
    icon: '🛵',
    baseUrl: 'https://api.bolt.eu',
    configFields: [
      { key: 'storeId', label: 'ID trgovine', type: 'text', required: true, placeholder: 'Bolt store ID' },
      { key: 'apiKey', label: 'API ključ', type: 'password', required: true, placeholder: 'Bolt API key' },
      { key: 'webhookSecret', label: 'Webhook skrivnost', type: 'password', required: true, placeholder: 'HMAC-SHA256 secret', helpText: 'Skupni ključ za preverjanje podpisov webhook naročil' },
      { key: 'autoAccept', label: 'Samodejno sprejemanje', type: 'select', required: true, defaultValue: 'true', options: [
        { value: 'true', label: 'Da — samodejno sprejmi vsa naročila' },
        { value: 'false', label: 'Ne — ročna potrditev' },
      ]},
    ],
    defaultEvents: ['order.created', 'order.ready', 'order.delivered', 'order.cancelled'],
    syncCapabilities: ['push_orders', 'pull_delivery_status', 'sync_menu', 'sync_availability', 'sync_all_channels'],
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

// F6-7: Labor management konektorji (7shifts)
export const laborConnectors: IntegrationConnector[] = [
  // --- 7shifts (Labor Scheduling + Payroll + Tips) ---
  {
    id: '7shifts',
    name: '7shifts',
    type: 'crm', // uporabimo crm tip ker ni posebnega labor tipa
    provider: '7shifts',
    description: 'Integracija z 7shifts — vodilna platforma za labor management v restavracijah. AI forecast labora glede na prodajo, scheduling, tip management, payroll in retention tools. Built specifically za restavracije.',
    icon: '📅',
    baseUrl: 'https://api.7shifts.com/v2',
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, helpText: '7shifts API Key (iz Settings > Integrations)' },
      { key: 'companyId', label: 'Company ID', type: 'text', required: true, placeholder: '12345' },
      { key: 'locationId', label: 'Location ID', type: 'text', required: true, placeholder: '67890' },
      { key: 'syncTips', label: 'Sinhroniziraj napitnine', type: 'select', required: true, defaultValue: 'true', options: [
        { value: 'true', label: 'Da — pošiljaj tipe v 7shifts payroll' },
        { value: 'false', label: 'Ne — ročno vnos' },
      ]},
      { key: 'syncSchedule', label: 'Sinhroniziraj razpored', type: 'select', required: true, defaultValue: 'true', options: [
        { value: 'true', label: 'Da — prenesi razpored v POS' },
        { value: 'false', label: 'Ne — samo pošiljaj podatke' },
      ]},
    ],
    defaultEvents: ['shift.started', 'shift.ended', 'cash_register.closed', 'daily_report.ready'],
    syncCapabilities: ['push_tips', 'push_labor_hours', 'pull_schedule', 'pull_forecast', 'sync_employees'],
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

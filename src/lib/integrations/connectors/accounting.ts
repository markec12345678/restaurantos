// ============================================
// INTEGRACIJSKI KONEKTORJI — RAČUNOVODSKI KONEKTORJI
// e-Računi, Datalab Pantheon, Spire ERP
// ============================================

import type { IntegrationConnector } from './types'

export const accountingConnectors: IntegrationConnector[] = [
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
]

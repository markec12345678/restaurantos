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

  // --- QuickBooks Online (Intuit) — global standard ---
  {
    id: 'quickbooks-online',
    name: 'QuickBooks Online',
    type: 'accounting',
    provider: 'quickbooks',
    description: 'Integracija z QuickBooks Online (Intuit). Samodejno knjiženje prodaje, plačil in DDV v double-entry formatu. Podpira OAuth 2.0, dnevno/tedensko sinhronizacijo in mapping kontov. Najbolj uporabljen računovodski program v ZDA/UK/Kanadi.',
    icon: '💹',
    baseUrl: 'https://quickbooks.api.intuit.com',
    configFields: [
      { key: 'clientId', label: 'OAuth Client ID', type: 'text', required: true, placeholder: 'AB1234567890abcdef', helpText: 'Intuit Developer App Client ID' },
      { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password', required: true, helpText: 'Intuit Developer App Client Secret' },
      { key: 'realmId', label: 'Company Realm ID', type: 'text', required: true, placeholder: '123456789012345', helpText: 'QuickBooks Company ID (Pridobljen ob OAuth avtorizaciji)' },
      { key: 'environment', label: 'Okolje', type: 'select', required: true, defaultValue: 'production', options: [
        { value: 'production', label: 'Produkcija' },
        { value: 'sandbox', label: 'Sandbox (testno)' },
      ]},
      { key: 'accountMapping', label: 'Mapiranje kontov', type: 'select', required: true, defaultValue: 'auto', options: [
        { value: 'auto', label: 'Samodejno (ustvari račun)' },
        { value: 'manual', label: 'Ročno (vnesi ID-je)' },
      ]},
      { key: 'syncMode', label: 'Način sinhronizacije', type: 'select', required: true, defaultValue: 'daily', options: [
        { value: 'realtime', label: 'Realno-časovno (ob vsakem plačilu)' },
        { value: 'hourly', label: 'Vsako uro' },
        { value: 'daily', label: 'Dnevno (ob zaključku izmene)' },
      ]},
    ],
    defaultEvents: ['order.paid', 'cash_register.closed', 'daily_report.ready'],
    syncCapabilities: ['push_journal_entries', 'push_invoices', 'push_payments', 'sync_chart_of_accounts', 'pull_trial_balance'],
  },

  // --- Xero — global standard (UK/AU/NZ) ---
  {
    id: 'xero',
    name: 'Xero',
    type: 'accounting',
    provider: 'xero',
    description: 'Integracija z Xero računovodskim programom. Samodejno knjiženje prodaje v double-entry formatu (JournalEntry), sinhronizacija plačil in DDV. Podpira OAuth 2.0 in Manual Journals API. Priljubljen v UK, Avstraliji, Novi Zelandiji.',
    icon: '🔷',
    baseUrl: 'https://api.xero.com',
    configFields: [
      { key: 'clientId', label: 'OAuth Client ID', type: 'text', required: true, placeholder: 'A1B2C3D4E5F6G7H8I9J0', helpText: 'Xero App Client ID' },
      { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password', required: true },
      { key: 'tenantId', label: 'Tenant ID', type: 'text', required: true, placeholder: '00000000-0000-0000-0000-000000000000', helpText: 'Xero Organization Tenant ID (pridobljen ob OAuth)' },
      { key: 'syncMode', label: 'Način sinhronizacije', type: 'select', required: true, defaultValue: 'daily', options: [
        { value: 'realtime', label: 'Realno-časovno (ob vsakem plačilu)' },
        { value: 'hourly', label: 'Vsako uro' },
        { value: 'daily', label: 'Dnevno (ob zaključku izmene)' },
      ]},
      { key: 'accountMapping', label: 'Mapiranje kontov', type: 'select', required: true, defaultValue: 'auto', options: [
        { value: 'auto', label: 'Samodejno (ustvari račun)' },
        { value: 'manual', label: 'Ročno (vnesi ID-je)' },
      ]},
    ],
    defaultEvents: ['order.paid', 'cash_register.closed', 'daily_report.ready'],
    syncCapabilities: ['push_journal_entries', 'push_invoices', 'push_payments', 'sync_chart_of_accounts', 'pull_trial_balance'],
  },
]

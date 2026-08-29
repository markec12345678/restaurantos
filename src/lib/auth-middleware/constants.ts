// ============================================
// KONSTANTE ZA AVTENTIKACIJSKI MIDDLEWARE
// TTL, omejitve, javne rute, dovoljenja po rutah
// ============================================

import type { Permission } from './types'

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 ur
export const MAX_SESSIONS = 500 // Prepreči pomnilniško puščanje — omejitev sej

// Rute, ki ne zahtevajo avtentikacijo (SAMO za GET zahtevke!)
// FIX HIGH: POST/PUT/DELETE na teh rutah ZAHTEVAJO avtentikacijo
export const PUBLIC_GET_ROUTES = [
  '/api/auth',            // Login — avtentikacija sama po sebi
  '/api/public',          // Javne rute za QR naročanje
  '/api/qr-menu',         // Javni meni za QR
  '/api/digital-receipt', // Javni digitalni račun za goste (QR link)
  '/api/feedback-public', // Javni API za mnenja gostov (QR kiosk)
]

// Zahtevana dovoljenja za posamezne rute
// FIX NAPAKA 5 (HTTP 403): Star beginsWith matching je blokiral natakarje dostop
// do bistvenih konfiguracijskih podatkov (dining-options, alt-payment-types, void-reasons).
// Sedaj so specifične pod-poti navedene eksplicitno z nižjimi dovoljenji.
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  // ═══════════════════════════════════════════
  // SPECIFIČNE POD-POTI /api/configuration/[tab]
  // Bistvene za prodajo — dostopne z take_orders
  // ═══════════════════════════════════════════
  '/api/configuration/dining-options': ['take_orders'],     // Način postrežbe
  '/api/configuration/alt-payment-types': ['take_orders'],  // Alternativna plačila (potrebno za PaymentDialog)
  '/api/configuration/price-groups': ['take_orders'],       // Ceniki (prikaz cen artiklov)
  '/api/configuration/void-reasons': ['take_orders'],       // Razlogi za storno (VoidItemDialog)
  '/api/configuration/no-sale-reasons': ['take_orders'],   // Razlogi no-sale (CashRegister)
  '/api/configuration/service-charges': ['take_orders'],   // Servisne postavke (dodajanje k naročilu)
  '/api/configuration/prep-stations': ['take_orders'],     // Kuhinjske postaje (KDS routing)
  '/api/configuration/sales-categories': ['take_orders'],   // Prodajne kategorije (analitika)
  '/api/configuration/revenue-centers': ['take_orders'],    // Prihodkovni centri (multi-location)
  '/api/configuration/discounts': ['apply_discounts'],     // Popusti
  '/api/configuration/printers': ['admin'],                // Tiskalniki (admin-only)
  '/api/configuration/tax-rates': ['admin'],                // DDV stopnje (admin-only)
  '/api/configuration': ['admin'],                          // General config (vsi podatki) — admin only

  // ═══════════════════════════════════════════
  // OSNOVNE API RUTE
  // ═══════════════════════════════════════════
  '/api/orders': ['take_orders'],
  '/api/payments': ['take_orders', 'manage_cash'],
  '/api/receipts': ['take_orders', 'manage_cash'],
  '/api/checks': ['take_orders'],
  '/api/tables': ['take_orders'],
  '/api/discounts': ['apply_discounts'],
  '/api/inventory': ['manage_inventory'],
  '/api/employees': ['manage_employees'],
  '/api/loyalty': ['take_orders'],
  '/api/gift-cards': ['take_orders'],
  '/api/guests': ['take_orders'],
  '/api/reservations': ['take_orders'],
  '/api/waitlist': ['take_orders'],
  '/api/suppliers': ['manage_inventory'],
  '/api/purchase-orders': ['manage_inventory'],
  '/api/dashboard': ['view_reports'],
  '/api/reports': ['view_reports'],
  '/api/cash-register': ['manage_cash'],
  '/api/shifts': ['manage_employees'],
  '/api/time-entries': ['manage_employees'],
  '/api/haccp': ['admin'],
  '/api/webhooks': ['admin'],
  '/api/settings': ['admin'],
  '/api/print': ['take_orders'],
  '/api/kitchen': ['take_orders'],
  '/api/delivery': ['take_orders'],
  '/api/furs': ['admin'],
  '/api/audit': ['admin'],
  '/api/ws-broadcast': ['take_orders'],
  '/api/packaging': ['manage_inventory'],
  '/api/courses': ['take_orders'],
  '/api/jobs': ['manage_employees'],
  '/api/ai-assistant': ['admin'],
  '/api/ai': ['admin'],
  '/api/card-terminal': ['manage_cash'],
  '/api/food-cost': ['manage_inventory'],
  '/api/happy-hour': ['apply_discounts'],
  '/api/recipes': ['manage_inventory'],
  '/api/seed': ['admin'],
  '/api/seed-food-norms': ['admin'],
  '/api/seed-norms': ['admin'],
  '/api/stock': ['manage_inventory'],
  '/api/menus': ['take_orders'],
  '/api/categories': ['take_orders'],
  '/api/menu-items': ['take_orders'],
  '/api/modifier-groups': ['take_orders'],
  '/api/integrations': ['admin'],
  '/api/subscription': ['admin'],
  '/api/delivery-zones': ['take_orders'],
  '/api/opening-hours': ['take_orders'],
  '/api/locations': ['take_orders'],
  '/api/delivery-tracking': ['take_orders'],
  '/api/tip-pool': ['manage_cash'],
  // FIX NAPAKA 5 (HTTP 403): daily-checklist je viden natakarjem v sidebar (permission: take_orders),
  // ampak je prej zahteval 'admin'. HACCP checklist se uporablja v dnevni rutini natakarjev.
  '/api/daily-checklist': ['take_orders'],
  '/api/order-items': ['take_orders'],
  '/api/staff-performance': ['manage_employees'],
  '/api/stock/check': ['manage_inventory'],
  '/api/end-of-day': ['manage_cash'],
  '/api/z-report': ['manage_cash'],
  '/api/digital-receipt': ['take_orders'],
  '/api/expenses': ['manage_cash'],
  '/api/feedback-public': [],
}

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
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
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
  '/api/guests': ['take_orders'],           // FIX: Dodana pot za goste CRM
  '/api/reservations': ['take_orders'],     // FIX: Dodana pot za rezervacije
  '/api/waitlist': ['take_orders'],         // FIX: Dodana pot za čakalno vrsto
  '/api/suppliers': ['manage_inventory'],   // FIX: Dodana pot za dobavitelje
  '/api/purchase-orders': ['manage_inventory'], // FIX: Dodana pot za nabavna naročila
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
  '/api/configuration': ['admin'],
  '/api/integrations': ['admin'],            // Integration API — povezave z zunanjimi sistemi
  '/api/subscription': ['admin'],            // SaaS naročnina — upravljanje paketov
  '/api/delivery-zones': ['take_orders'],    // Cone dostave — upravljanje con
  '/api/opening-hours': ['take_orders'],     // Delovni čas — urniki lokacij
  '/api/locations': ['take_orders'],         // Lokacije — multi-location podpora
  // FIX HIGH: Manjkajoče rute v ROUTE_PERMISSIONS
  '/api/delivery-tracking': ['take_orders'], // GPS sledenje voznikom
  '/api/tip-pool': ['manage_cash'],          // Razdelitev napitnin
  '/api/daily-checklist': ['admin'],         // HACCP checklist
  '/api/order-items': ['take_orders'],       // Upravljanje postavk naročil
  '/api/staff-performance': ['manage_employees'], // Performanse zaposlenih
  '/api/stock/check': ['manage_inventory'],  // Preverjanje zaloge
  '/api/end-of-day': ['manage_cash'],        // Zaključek dneva
  '/api/z-report': ['manage_cash'],          // Z-poročilo
  '/api/digital-receipt': ['take_orders'],   // Digitalni račun
  '/api/expenses': ['manage_cash'],          // Stroški
  '/api/feedback-public': [],                // Javni feedback (auth required, no special perm)
}

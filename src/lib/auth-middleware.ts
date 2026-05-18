// ============================================
// AVTENTIKACIJSKI MIDDLEWARE ZA POS API
// Profesionalna zaščita vseh API rut
// Bearer token verifikacija + role-based dostop
// ============================================

import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Aktivne seje (v produkciji bi bile v Redis/DB)
interface Session {
  token: string
  employeeId: string
  role: string
  permissions: string[]
  createdAt: number
  expiresAt: number
  absoluteExpiry: number  // Absolute max lifetime (24h)
}

const sessions = new Map<string, Session>()
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 ur
const MAX_SESSIONS = 500 // Prepreči pomnilniško puščanje — omejitev sej

// Čiščenje poteklih sej vsakih 30 minut
setInterval(() => {
  const now = Date.now()
  for (const [token, session] of sessions) {
    if (session.expiresAt < now || session.absoluteExpiry < now) {
      sessions.delete(token)
    }
  }
  // Če je še vedno preveč sej, odstrani najstarejše
  if (sessions.size > MAX_SESSIONS) {
    const entries = [...sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
    const toRemove = entries.slice(0, sessions.size - MAX_SESSIONS)
    for (const [token] of toRemove) {
      sessions.delete(token)
    }
  }
}, 30 * 60 * 1000)

/**
 * Ustvari novo sejo po uspešni prijavi
 */
export function createSession(employee: {
  id: string
  role: string
  permissions: string[]
}): string {
  const token = crypto.randomBytes(32).toString('hex')
  const now = Date.now()

  sessions.set(token, {
    token,
    employeeId: employee.id,
    role: employee.role,
    permissions: employee.permissions,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    absoluteExpiry: now + 24 * 60 * 60 * 1000, // 24 hours absolute max
  })

  return token
}

/**
 * Preveri veljavnost tokena in vrne sejo
 */
export function verifyToken(token: string): Session | null {
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  if (session.absoluteExpiry < Date.now()) {
    sessions.delete(token)
    return null
  }
  return session
}

/**
 * Uniči sejo (odjava)
 */
export function destroySession(token: string): void {
  sessions.delete(token)
}

/**
 * Pridobi Bearer token iz Authorization glave
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.substring(7).trim()
}

// ============================================
// MIDDLEWARE FUNKCIJE
// ============================================

type Permission = 
  | 'take_orders' 
  | 'void_items' 
  | 'apply_discounts' 
  | 'manage_cash' 
  | 'manage_inventory' 
  | 'manage_employees' 
  | 'view_reports' 
  | 'admin'

// Rute, ki ne zahtevajo avtentikacijo (SAMO za GET zahtevke!)
// FIX HIGH: POST/PUT/DELETE na teh rutah ZAHTEVAJO avtentikacijo
const PUBLIC_GET_ROUTES = [
  '/api/auth',            // Login — avtentikacija sama po sebi
  '/api/public',          // Javne rute za QR naročanje
  '/api/qr-menu',         // Javni meni za QR
  '/api/digital-receipt', // Javni digitalni račun za goste (QR link)
  '/api/feedback-public', // Javni API za mnenja gostov (QR kiosk)
]

// Zahtevana dovoljenja za posamezne rute
const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
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
}

/**
 * Preveri ali ruta zahteva avtentikacijo
 */
function isPublicRoute(pathname: string): boolean {
  // FIX HIGH: Javne rute so javne SAMO za GET — POST/PUT/DELETE zahtevajo avtentikacijo
  // /api/auth je izjema — login POST je dovoljen brez tokena
  if (pathname.startsWith('/api/auth')) return true
  if (pathname.startsWith('/api/public')) return true
  if (pathname.startsWith('/api/feedback-public')) return true // Javni QR kiosk za mnenja
  return PUBLIC_GET_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Pridobi zahtevana dovoljenja za route
 */
function getRequiredPermissions(pathname: string): Permission[] {
  for (const [route, perms] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route)) {
      return perms
    }
  }
  return [] // Brez specifičnih zahtev = vsak avtenticiran uporabnik
}

/**
 * Preveri ali ima uporabnik potrebna dovoljenja
 */
function hasPermission(session: Session, requiredPerms: Permission[]): boolean {
  if (session.role === 'admin' || session.role === 'manager') return true
  if (requiredPerms.length === 0) return true
  return requiredPerms.every(perm => session.permissions.includes(perm))
}

/**
 * GLAVNA MIDDLEWARE FUNKCIJA
 * Uporaba v API rutah:
 * 
 *   const authResult = await requireAuth(req)
 *   if (authResult.error) return authResult.error
 *   const session = authResult.session!
 */
export async function requireAuth(
  req: Request,
  options?: { permission?: Permission | Permission[] }
): Promise<{ session: Session | null; error: NextResponse | null }> {
  const { pathname } = new URL(req.url)

  // GET zahteve na javnih rutah so dovoljene brez avtentikacije
  if (req.method === 'GET' && isPublicRoute(pathname)) {
    return { session: null, error: null }
  }

  const token = extractBearerToken(req)

  if (!token) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Avtentikacija je obvezna. Pošljite Authorization: Bearer <token>' },
        { status: 401 }
      ),
    }
  }

  const session = verifyToken(token)

  if (!session) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Neveljaven ali potekel žeton. Prosimo, prijavite se ponovno.' },
        { status: 401 }
      ),
    }
  }

  // Preveri dovoljenja
  const requiredPerms = options?.permission
    ? Array.isArray(options.permission) ? options.permission : [options.permission]
    : getRequiredPermissions(pathname)

  if (!hasPermission(session, requiredPerms)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Nimate dovoljenja za to operacijo.' },
        { status: 403 }
      ),
    }
  }

  // Podaljšaj sejo ob aktivnosti (ne preseži absoluteExpiry)
  session.expiresAt = Math.min(Date.now() + SESSION_TTL_MS, session.absoluteExpiry)

  return { session, error: null }
}

/**
 * Izbirna avtentikacija — ne vrne napake, če ni tokena
 * Uporabno za rute, ki delujejo drugače za avtenticirane uporabnike
 */
export async function optionalAuth(
  req: Request
): Promise<{ session: Session | null }> {
  const token = extractBearerToken(req)
  if (!token) return { session: null }
  const session = verifyToken(token)
  return { session }
}

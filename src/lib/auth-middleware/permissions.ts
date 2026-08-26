// ============================================
// PREVERJANJE DOVOLJENJ IN JAVNIH RUT
// Permission checking + route classification
// ============================================

import type { Session, Permission } from './types'
import { PUBLIC_GET_ROUTES, ROUTE_PERMISSIONS } from './constants'

/**
 * Preveri ali ruta zahteva avtentikacijo
 */
export function isPublicRoute(pathname: string): boolean {
  // FIX HIGH: Javne rute so javne SAMO za GET — POST/PUT/DELETE zahtevajo avtentikacije
  // /api/auth je izjema — login POST je dovoljen brez tokena
  if (pathname.startsWith('/api/auth')) return true
  if (pathname.startsWith('/api/public')) return true
  if (pathname.startsWith('/api/feedback-public')) return true // Javni QR kiosk za mnenja
  // FIX WORKFLOW-49: /api/setup je javen (GET in POST) — first-run inicializacija
  if (pathname.startsWith('/api/setup')) return true
  return PUBLIC_GET_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Pridobi zahtevana dovoljenja za route
 */
export function getRequiredPermissions(pathname: string): Permission[] {
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
export function hasPermission(session: Session, requiredPerms: Permission[]): boolean {
  // FIX CRITICAL: Admin ima poln dostop, manager le do non-admin rut
  if (session.role === 'admin') return true
  if (session.role === 'manager' && !requiredPerms.includes('admin')) return true
  if (requiredPerms.length === 0) return true
  return requiredPerms.every(perm => session.permissions.includes(perm))
}

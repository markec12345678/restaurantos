// tenant-scope.ts — EDINI modul za multi-tenant scoping (BUG-HUNT R80 unifikacija)
//
// TENANT SCOPE AUDIT 2026-09-09 (uporabnikova točka 7):
//   Odločitev: MODEL A — katalog in konfiguracija so PO LOKACIJI
//   (Menu/Table/TaxRate/DiningOption/... NOT NULL locationId, migracija
//   0003_tenant_model_a). Deljenje med lokacijami je izključno eksplicitno
//   (kopija prek /api/locations/sync). Nikoli implicitno "globalno" ali
//   "prvi aktivni lokaciji".
//
//   Ta modul je EDINO dovoljeno mesto za izpeljevanje scope-a iz seje:
//   zaposleni z dodeljeno lokacijo LAHKO dostopa SAMO do svoje lokacije;
//   admin brez lokacije (super-admin/lastnik) ima cross-lokacijski nadzor
//   (vidi vse, USTVARJA pa lahko samo z izrecnim locationId).
//
// R80 UNIFIKACIJA: do zdaj sta obstajala DVA modula z podvojenim pravilnikom —
//   1) ta modul (MODEL A katalog: resolveCatalogScope/locationFilter/...)
//   2) src/lib/auth-middleware/tenant-scope.ts (transakcijski resolver:
//      resolveTenantLocationId/tenantScopeToWhere/...)
//   Oba sta definiranа svoja admin role seta in svoje fail-closed sporočilo.
//   Zdaj je tukaj EN vir resnice: skupni TENANT_ADMIN_ROLES, skupno
//   NO_LOCATION_MESSAGE in skupni role-aware matriki. Stara pot
//   '@/lib/auth-middleware/tenant-scope' ostane kot deprecated re-export shim,
//   da barrel '@/lib/auth-middleware' in obstoječi importi delujejo nespremenjeno.
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// --- Skupni vir resnice: role logika + fail-closed sporočilo ---

/** Eduro dovoljeni admin/multi-branch role set — edini v codebase-u. */
export const TENANT_ADMIN_ROLES = new Set(['admin', 'super_admin'])

/** Enojavno preverjanje admin vloge (null/undefined = false — nikoli fail-open). */
export function isAdminTenantRole(role: string | null | undefined): boolean {
  return !!role && TENANT_ADMIN_ROLES.has(role)
}

/** Skupno fail-closed sporočilo za seja brez dodeljene lokacije (403). */
export const NO_LOCATION_MESSAGE =
  'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.'

/**
 * Strukturno minimalen session — auth-middleware `Session` ga zadovolji
 * (employeeId/role/locationId). Namenjeno temu modulu, da NE importira
 * auth-middleware (prepreči ciklične importe).
 */
export type TenantScopeSession = {
  employeeId?: string
  role?: string
  locationId?: string | null
}

/** Scope lokacije iz seje. null = admin brez dodeljene lokacije (cross-lokacijski nadzor). */
export type LocationScope = string | null

// =====================================================================
// 1. TRANSAKCIJSKI RESOLVER (prej: auth-middleware/tenant-scope.ts)
// =====================================================================
// Centralni helper za multi-tenant isolation. Reši tri kritične težave:
//
// 1. IDOR bypass preko ?locationId parametra
//    (regular user bi lahko pošiljal ?locationId=loc-b in dostopal do tuje lokacije)
//
// 2. Fail-closed za regular user brez session.locationId
//    (če Employee.locationId ni nastavljen in role ni admin, DENY — ne dovoli vse)
//
// 3. Magic string past ("__DENIED__")
//    (prejšnji načrt je uporabljal magic string — interpretacijska napaka = bypass)
//
// Rešitev: strukturiran rezultat z discriminatorjem (Tagged Union).
// Klicatelj MORA obravnavati vse tri primere ali uporabiti convenient helper.

export type TenantScopeResult =
  | { ok: true; locationId: string; source: 'session' | 'query'; isCrossBranch: boolean }
  | { ok: true; locationId: null; source: 'admin_global'; isCrossBranch: boolean }
  | { ok: false; reason: 'no_session' | 'regular_user_without_location'; error: NextResponse }

/**
 * Resolve tenant locationId iz session + query parametra.
 *
 * Pravila:
 * 1. Regular user (non-admin): session.locationId je AVTORITATIVEN.
 *    - Če je null → DENY (fail-closed, data integrity issue)
 *    - Query parameter ?locationId se IGNORIRA (prepreči bypass)
 *
 * 2. Admin z session.locationId: uporabi session.locationId (admin restricted to location)
 *    - Query parameter se IGNORIRA
 *
 * 3. Admin z session.locationId=null (super admin): lahko dostopa do vseh lokacij
 *    - Če je ?locationId podan, uporabi ga (cross-branch access, auditirano)
 *    - Če ni podan, vrne null (global view)
 *
 * @param session - uporabniška seja iz requireAuth()
 * @param searchParams - URLSearchParams iz req.url (lahko tudi prazno)
 * @param options.endpoint - ime endpointa za audit log (npr. 'GET /api/orders')
 * @param options.auditLogger - funkcija za cross-branch audit log (option)
 *
 * @returns TenantScopeResult — strukturiran rezultat, NIKOLI ne vrne null/undefined
 *
 * @example
 * const authResult = await requireAuth(req, ...)
 * if (authResult.error) return authResult.error
 * const scope = resolveTenantLocationId(authResult.session, searchParams, {
 *   endpoint: 'GET /api/orders',
 * })
 * if (!scope.ok) return scope.error // DENY
 * const where = { ...(scope.locationId ? { locationId: scope.locationId } : {}) }
 */
export function resolveTenantLocationId(
  session: TenantScopeSession | null | undefined,
  searchParams: URLSearchParams | null | undefined,
  options?: {
    endpoint?: string
    auditLogger?: (entry: {
      employeeId: string
      endpoint: string
      requestedLocationId: string
      sessionLocationId: string | null
    }) => void | Promise<void>
  },
): TenantScopeResult {
  // 1. Brez session → DENY
  if (!session) {
    return {
      ok: false,
      reason: 'no_session',
      error: NextResponse.json(
        { error: 'Avtentikacija je obvezna.' },
        { status: 401 },
      ),
    }
  }

  const sessionLocationId = session.locationId ?? null
  const requestedLocationId = searchParams?.get('locationId') ?? searchParams?.get('branchId') ?? null
  const isAdmin = isAdminTenantRole(session.role)

  // 2. Regular user (non-admin) — session.locationId je avtoritativen
  if (!isAdmin) {
    if (!sessionLocationId) {
      // Fail-closed: regular user brez locationId = data integrity issue
      return {
        ok: false,
        reason: 'regular_user_without_location',
        error: NextResponse.json({ error: NO_LOCATION_MESSAGE }, { status: 403 }),
      }
    }
    // Regular user: vedno uporabi session.locationId, ignoriraj query
    return {
      ok: true,
      locationId: sessionLocationId,
      source: 'session',
      isCrossBranch: false,
    }
  }

  // 3. Admin z session.locationId — uporabi svojo lokacijo (admin restricted to location)
  if (sessionLocationId) {
    return {
      ok: true,
      locationId: sessionLocationId,
      source: 'session',
      isCrossBranch: false,
    }
  }

  // 4. Admin brez session.locationId (super admin) — lahko uporabi query
  if (requestedLocationId) {
    // Cross-branch access — auditiraj (non-blocking)
    if (options?.auditLogger && options?.endpoint) {
      try {
        Promise.resolve(
          options.auditLogger({
            employeeId: session.employeeId ?? '',
            endpoint: options.endpoint,
            requestedLocationId,
            sessionLocationId: null,
          }),
        ).catch(() => {
          // Audit log failure ne sme blokirati requesta
        })
      } catch {
        // Non-blocking
      }
    }
    return {
      ok: true,
      locationId: requestedLocationId,
      source: 'query',
      isCrossBranch: true,
    }
  }

  // 5. Super admin brez query parametra — global view (locationId = null)
  return {
    ok: true,
    locationId: null,
    source: 'admin_global',
    isCrossBranch: false,
  }
}

/**
 * Pomožni helper, ki iz TenantScopeResult generira Prisma where filter.
 *
 * @example
 * const scope = resolveTenantLocationId(...)
 * if (!scope.ok) return scope.error
 * const where = { status: 'pending', ...tenantScopeToWhere(scope) }
 * const orders = await db.order.findMany({ where })
 */
export function tenantScopeToWhere(
  // Sprejeme tudi poenostavljen { locationId } (npr. rezultat
  // resolveTenantLocationIdOrThrow) — ok-varianta je podtipska.
  scope: { locationId: string | null },
): { locationId?: string } {
  return scope.locationId ? { locationId: scope.locationId } : {}
}

/**
 * Enojni helper, ki resolve-a tenant scope in takoj vrne NextResponse na DENY.
 * Uporabno za krajše endpointe kjer ne potrebujete podrobnosti o source.
 *
 * @returns { locationId: string | null } ali { error: NextResponse } — pogojno
 *
 * @example
 * const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams)
 * if ('error' in scope) return scope.error
 * const where = { ...(scope.locationId ? { locationId: scope.locationId } : {}) }
 */
export function resolveTenantLocationIdOrThrow(
  session: TenantScopeSession | null | undefined,
  searchParams: URLSearchParams | null | undefined,
  options?: { endpoint?: string },
): { locationId: string | null } | { error: NextResponse } {
  const scope = resolveTenantLocationId(session, searchParams, options)
  if (!scope.ok) return { error: scope.error }
  return { locationId: scope.locationId }
}

// =====================================================================
// 2. MODEL A katalog helperji
// =====================================================================

export type CatalogScopeResult =
  | { ok: true; scope: LocationScope }
  | { ok: false; response: NextResponse }

/** Izlušči scope iz rezultata requireAuth (session.locationId iz Employee).
 *  @deprecated Od R80 uporabljaj role-aware resolveCatalogScope / resolveTenantLocationId. */
export function sessionLocationId(
  authResult: { session?: { locationId?: string | null } | null } | null | undefined,
): LocationScope {
  return authResult?.session?.locationId ?? null
}

/**
 * Role-aware scope resolucija za MODEL A (katalog/konfiguracija) rute.
 * Uporaba:
 *
 *   const scopeRes = resolveCatalogScope(authResult)
 *   if (!scopeRes.ok) return scopeRes.response
 *   const where = { ...locationFilter(scopeRes.scope) }
 */
export function resolveCatalogScope(authResult: {
  session?: { locationId?: string | null; role?: string } | null
} | null | undefined): CatalogScopeResult {
  const session = authResult?.session
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Neavtenticiran.' }, { status: 401 }),
    }
  }
  const loc = session.locationId ?? null
  if (loc) return { ok: true, scope: loc }
  if (isAdminTenantRole(session.role)) return { ok: true, scope: null }
  return {
    ok: false,
    response: NextResponse.json({ error: NO_LOCATION_MESSAGE }, { status: 403 }),
  }
}

/**
 * Where-dodatek za MODELE z lastnim locationId (Menu, Table, TaxRate,
 * DiningOption, Printer, ...). Admin brez lokacije vidi vse (nadzor).
 *
 *   db.menu.findMany({ where: { isActive: true, ...locationFilter(scope) } })
 */
export function locationFilter(scope: LocationScope): Record<string, unknown> {
  return scope ? { locationId: scope } : {}
}

/**
 * Where-dodatek za MenuItem — scope prek verige Category → Menu
 * (MenuItem NIMA lastnega locationId — MODEL A "scope prek Category").
 */
export function menuItemLocationFilter(scope: LocationScope): Record<string, unknown> {
  return scope ? { category: { menu: { locationId: scope } } } : {}
}

/** Where-dodatek za Category — scope prek Menu. */
export function categoryLocationFilter(scope: LocationScope): Record<string, unknown> {
  return scope ? { menu: { locationId: scope } } : {}
}

/**
 * MODEL A guard za PISNE operacije: lokacija zapisa se izpelje iz seje;
 * admin brez lokacije MORA podati izrecen locationId (query/body).
 * Zaposleni NIKOLI ne more podati tuje lokacije (body se ignorira).
 *
 * Vrne { ok, locationId } ali { ok: false, response } (400 — vrn direkt).
 */
export function resolveWriteLocationId(
  scope: LocationScope,
  ...candidates: unknown[]
): { ok: true; locationId: string } | { ok: false; response: NextResponse } {
  if (scope) return { ok: true, locationId: scope }
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return { ok: true, locationId: c.trim() }
    }
  }
  return {
    ok: false,
    response: NextResponse.json(
      {
        error:
          'locationId je obvezen (MODEL A): seja nima dodeljene lokacije — podaj locationId (admin) ali se prijavi kot zaposleni z lokacijo.',
      },
      { status: 400 },
    ),
  }
}

/**
 * MODEL A guard: preveri, da vsi podani artikli pripadajo menijem na PODANI
 * lokaciji (veriga MenuItem → Category → Menu). Vrne ID prvega tujega
 * artikla ali null (vsi v redu). Uporaba v money-path (orders, add-items,
 * online-order): tuj artikel = ZAVRNJEN, ne "tiho sprejet".
 */
export async function findMenuItemOutsideLocation(
  menuItemIds: string[],
  locationId: string | null,
): Promise<string | null> {
  if (!locationId || menuItemIds.length === 0) return null
  const inScope = await db.menuItem.findMany({
    where: { id: { in: menuItemIds }, category: { menu: { locationId } } },
    select: { id: true },
  })
  const ok = new Set(inScope.map((i) => i.id))
  return menuItemIds.find((id) => !ok.has(id)) ?? null
}

/**
 * MODEL A guard za pisanje prek ID: preveri, da zapis pripada scope-u.
 * Vrne true, če sme admin (scope null) ali zapis leži na lokaciji.
 */
export function isWithinScope(scope: LocationScope, resourceLocationId: string | null | undefined): boolean {
  if (!scope) return true // admin cross-lokacijski nadzor
  return resourceLocationId === scope
}

/** Standardni 404 odgovor za zunaj-scope vire (enako sporočilo za vse rake). */
export function notInScopeResponse(what: string): NextResponse {
  // Namerno 404 (ne 403): ne razkrivamo obstoaja vira na drugi lokaciji.
  return NextResponse.json({ error: `${what} ni najden` }, { status: 404 })
}

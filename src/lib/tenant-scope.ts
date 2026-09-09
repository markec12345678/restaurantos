// tenant-scope.ts — MODEL A: centralni helperji za multi-tenant scoping
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
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/** Scope lokacije iz seje. null = admin brez dodeljene lokacije (cross-lokacijski nadzor). */
export type LocationScope = string | null

/** Izlušči scope iz rezultata requireAuth (session.locationId iz Employee). */
export function sessionLocationId(
  authResult: { session?: { locationId?: string | null } | null } | null | undefined,
): LocationScope {
  return authResult?.session?.locationId ?? null
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

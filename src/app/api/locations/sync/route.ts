import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import {

  locationSyncSchema,
  fetchSourceMenus,
  syncMenusToTargets,
  fetchMenuComparison,
  buildMenuComparison,
} from './_helpers'

// POST /api/locations/sync — Sinhroniziraj meni iz izvorne lokacije na ciljne
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, locationSyncSchema)
    if (validationError) return validationError

    // FIX R76 (tenant scope): cross-location menu sync je super-admin operacija.
    // Prej: vsak admin Permission='admin' je lahko sinhroniziral iz KATERE KOLI izvorne
    // lokacije na KATERE KOLI ciljne — cross-tenant pisanje (uničenje tujega menija)
    // in branje (izvor menija drugega tenant-a). Zdaj: lokacijsko vezana seja (admin
    // z session.locationId) sme samo source=own IN targets⊆{own}; globalna seja
    // (super-admin, locationId=null) sme cross-location.
    const sessionLocId = authResult.session?.locationId ?? null
    if (sessionLocId) {
      if (data.sourceLocationId !== sessionLocId) {
        return NextResponse.json(
          { error: 'Cross-location sync ni dovoljen: izvorna lokacija ni vaša lokacija.' },
          { status: 403 },
        )
      }
      const foreignTargets = data.targetLocationIds.filter(id => id !== sessionLocId)
      if (foreignTargets.length > 0) {
        return NextResponse.json(
          { error: 'Cross-location sync ni dovoljen: ciljne lokacije niso vaša lokacija. Cross-location sinhronizacija zahteva globalnega administratorja.' },
          { status: 403 },
        )
      }
    }

    // Preveri izvorno lokacijo
    const sourceLocation = await db.location.findUnique({
      where: { id: data.sourceLocationId },
    })
    if (!sourceLocation) {
      return NextResponse.json({ error: 'Izvorna lokacija ne obstaja' }, { status: 404 })
    }

    // Preveri ciljne lokacije
    const targetLocations = await db.location.findMany({
      where: { id: { in: data.targetLocationIds } },
    })
    if (targetLocations.length !== data.targetLocationIds.length) {
      return NextResponse.json({ error: 'Nekatere ciljne lokacije ne obstajajo' }, { status: 404 })
    }

    // Pridobi podatke iz izvorne lokacije
    const sourceMenus = await fetchSourceMenus(data.sourceLocationId)

    // =====================================================================
    // OPTIMIZACIJA N+1: Batch pridobivanje obstoječih entitet
    // Namesto individualnih findFirst klicev v zanki (N+1 problem),
    // pridobimo vse podatke za VSE ciljne lokacije v 3 poizvedbah
    // in zgradimo Map strukture za O(1) iskanje
    // =====================================================================

    const syncResults = data.dryRun
      ? targetLocations.map(loc => ({
          targetLocationId: loc.id,
          targetLocationName: loc.name,
          menusCreated: 0,
          categoriesCreated: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          modifiersCreated: 0,
          errors: [] as string[],
        }))
      : await syncMenusToTargets(data, sourceMenus, targetLocations)

    return NextResponse.json({
      success: true,
      sourceLocation: {
        id: sourceLocation.id,
        name: sourceLocation.name,
        menuCount: sourceMenus.length,
        categoryCount: sourceMenus.reduce((sum, m) => sum + m.categories.length, 0),
        itemCount: sourceMenus.reduce((sum, m) => sum + m.categories.reduce((s, c) => s + c.menuItems.length, 0), 0),
      },
      dryRun: data.dryRun,
      results: syncResults,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/locations/sync', 'Napaka pri sinhronizaciji')
  }
}

// GET /api/locations/sync — Pridobi primerjavo menijev med lokacijami
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R76 (tenant scope): lokacijsko vezana seja vidi samo svojo lokacijo.
    // Prej: seznam VSIH aktivnih lokacij + centralizirana poročila o prihodkih
    // (groupBy po narocilih BREZ locationId filtra) → puščanje prihodkov vseh tenant-ov.
    const sessionLocId = authResult.session?.locationId ?? null
    const locations = await db.location.findMany({
      where: { isActive: true, ...(sessionLocId ? { id: sessionLocId } : {}) },
      select: {
        id: true,
        name: true,
        code: true,
        _count: {
          select: {
            orders: true,
            tables: true,
            employees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const locationIds = locations.map(l => l.id)
    const countMap = await fetchMenuComparison(locationIds)
    const menuComparison = buildMenuComparison(locations, countMap)

    // Centralizirana poročila
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [dailyStats, monthlyStats] = await Promise.all([
      db.order.groupBy({
        by: ['type'],
        where: { createdAt: { gte: today }, ...(sessionLocId ? { locationId: sessionLocId } : {}) },
        _sum: { total: true },
        _count: true,
      }),
      db.order.groupBy({
        by: ['type'],
        where: {
          createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
          ...(sessionLocId ? { locationId: sessionLocId } : {}),
        },
        _sum: { total: true },
        _count: true,
      }),
    ])

    return NextResponse.json({
      locations,
      menuComparison,
      centralizedReports: {
        daily: dailyStats,
        monthly: monthlyStats,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/locations/sync', 'Napaka pri pridobivanju primerjave')
  }
}

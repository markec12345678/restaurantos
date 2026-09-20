// GET /api/setup/status — Preveri ali je sistem inicializiran
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const locationCount = await db.location.count()
    const employeeCount = await db.employee.count()
    const settingsCount = await db.restaurantSettings.count()

    const dbUrl = process.env.DATABASE_URL || ''
    const isMultiLocation = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
    const mode = isMultiLocation ? 'multi' : 'single'
    const isInitialized = employeeCount > 0 && locationCount > 0

    return NextResponse.json({
      isInitialized,
      mode,
      hasEmployees: employeeCount > 0,
      hasLocations: locationCount > 0,
      hasSettings: settingsCount > 0,
      // FIX R81 (enumeration): javni endpoint (brez autha) je anonimnim
      // klicateljem razkrival TOČNE števce (employees/locations/settings) —
      // tenant-count enumeration. Po inicializaciji je counts=null;
      // first-run (0 zaposlenih) ostane resničen, ker wizard potrebuje
      // counts samo PRED inicializacijo. Booleans (isInitialized/
      // hasEmployees/...) ostanejo za redirect UX (setup-redirect, middleware).
      counts: isInitialized
        ? null
        : { employees: employeeCount, locations: locationCount, settings: settingsCount },
      multiLocationReady: isMultiLocation,
      databaseUrl: isMultiLocation ? 'configured' : 'embedded',
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/setup/status', 'Napaka pri preverjanju stanja setup-a')
  }
}

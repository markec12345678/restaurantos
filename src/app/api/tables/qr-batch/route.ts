// GET /api/tables/qr-batch — Vrni seznam QR URL-jev za vse mize (za print nalepk)
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { getAppUrl } from '@/lib/utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R82-F (LEAK-HIGH): QR URL-ji so bili VSEH miz VSEH tenantov
    // (take_orders) — gost bi lahko vstopil v tujo QR sejo.
    // FIX R86-2c1: ročni role-check + raw `?? null` kanoniziran na centralni
    // resolver (istek fail-closed semantike: regular NULL → 403; super-admin
    // global / ?locationId; odstranjena podvojena role logika).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/tables/qr-batch',
    })
    if ('error' in scope) return scope.error

    const baseUrl = getAppUrl()
    const tables = await db.table.findMany({
      where: {
        status: { not: 'out-of-service' },
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
      },
      select: { id: true, number: true, area: true, capacity: true },
      orderBy: { number: 'asc' },
    })

    const qrCodes = tables.map(t => ({
      tableId: t.id,
      tableNumber: t.number,
      area: t.area,
      capacity: t.capacity,
      qrUrl: `${baseUrl}/qr/${t.id}`,
      qrImageUrl: `${baseUrl}/api/tables/${t.id}/qr`,
    }))

    return NextResponse.json({ tables: qrCodes, total: qrCodes.length, baseUrl })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/tables/qr-batch', 'Napaka pri pridobivanju QR kod')
  }
}

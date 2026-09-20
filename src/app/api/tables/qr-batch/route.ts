// GET /api/tables/qr-batch — Vrni seznam QR URL-jev za vse mize (za print nalepk)
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { getAppUrl } from '@/lib/utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R82-F (LEAK-HIGH): QR URL-ji so bili VSEH miz VSEH tenantov
    // (take_orders) — gost bi lahko vstopil v tujo QR sejo. Zdaj: scoped na
    // session lokacijo; staff brez lokacije → 403 fail-closed.
    const sessionLocId = authResult.session?.locationId ?? null
    if (!sessionLocId && !['admin', 'super_admin'].includes(authResult.session?.role || '')) {
      return NextResponse.json({ error: 'QR mize zahtevajo dodeljeno lokacijo.' }, { status: 403 })
    }

    const baseUrl = getAppUrl()
    const tables = await db.table.findMany({
      where: {
        status: { not: 'out-of-service' },
        ...(sessionLocId ? { locationId: sessionLocId } : {}),
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

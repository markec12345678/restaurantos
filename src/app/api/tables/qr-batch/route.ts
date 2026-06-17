// GET /api/tables/qr-batch — Vrni seznam QR URL-jev za vse mize (za print nalepk)
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { getAppUrl } from '@/lib/utils'


export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const baseUrl = getAppUrl()
    const tables = await db.table.findMany({
      where: { status: { not: 'out-of-service' } },
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

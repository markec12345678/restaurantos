// GET /api/purchase-orders/[id]/journal — Revizijski dnevnik za nabavno naročilo
// Vrne seznam vseh audit log vnosov povezanih s tem PO-jem.
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // Preveri da PO obstaja
    const po = await db.purchaseOrder.findUnique({ where: { id }, select: { id: true, poNumber: true } })
    if (!po) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

    // Pridobi audit log vnose za ta PO
    const auditLogs = await db.auditLog.findMany({
      where: {
        entityType: 'PurchaseOrder',
        entityId: id,
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })

    return NextResponse.json({ poNumber: po.poNumber, entries: auditLogs })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/purchase-orders/[id]/journal', 'Napaka pri pridobivanju dnevnika')
  }
}

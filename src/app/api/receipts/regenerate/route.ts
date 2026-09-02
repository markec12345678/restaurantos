// ============================================
// POST /api/receipts/regenerate
// ============================================
// Backfill manjkajočih Receipts za plačana naročila.
//
// Test 4.3 odkril: 36 paid orders ampak samo 5 receipts (31 orphaned).
// Vzrok: Receipt se ustvari v klientu (useProcessPayment.ts) po plačilu,
// ampak če je bilo plačilo ustvarjeno preko API-ja (test skripte),
// Receipt ni bil ustvarjen.
//
// Ta endpoint:
//   1. Najde vsa paid naročila brez Receipt
//   2. Za vsako ustvari Receipt preko handlePostReceipt
//   3. Vrne summary: processed, created, skipped, failed
//
// Varnost: zahteva admin permission
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handlePostReceipt } from '../[id]/_helpers/post-handler'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const { afterDate, all } = body as { afterDate?: string; all?: boolean }

    // Get all paid orders
    const where: Record<string, unknown> = { paymentStatus: 'paid' }
    if (afterDate) {
      where.paidAt = { gte: new Date(afterDate) }
    }

    const paidOrders = await db.order.findMany({
      where,
      select: { id: true, orderNumber: true, paidAt: true, paymentMethod: true },
      orderBy: { paidAt: 'asc' },
      take: all ? 1000 : 100,
    })

    if (paidOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Ni plačanih naročil za obdelavo',
        processed: 0,
        created: 0,
        skipped: 0,
        failed: 0,
      })
    }

    // Get existing receipts
    const existingReceipts = await db.receipt.findMany({
      where: { orderId: { in: paidOrders.map(o => o.id) } },
      select: { orderId: true, isStorno: true },
    })
    const ordersWithReceipt = new Set(
      existingReceipts.filter(r => !r.isStorno).map(r => r.orderId)
    )

    let created = 0
    let skipped = 0
    let failed = 0
    const errors: string[] = []

    for (const order of paidOrders) {
      // Skip if receipt already exists
      if (ordersWithReceipt.has(order.id)) {
        skipped++
        continue
      }

      try {
        // Call handlePostReceipt with a synthetic request
        // FIX: handlePostReceipt expects a Request object with JSON body
        const synthReq = new Request(`http://localhost/api/receipts/${order.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod: order.paymentMethod || 'cash',
            isStorno: false,
          }),
        })

        const result = await handlePostReceipt(synthReq, order.id, authResult)

        if (result instanceof NextResponse) {
          const status = result.status
          if (status === 201) {
            created++
          } else if (status === 200) {
            // Already exists (race condition)
            skipped++
          } else {
            failed++
            const body = await result.text().catch(() => '')
            errors.push(`Order #${order.orderNumber}: ${status} — ${body.substring(0, 100)}`)
          }
        } else {
          created++
        }
      } catch (err) {
        failed++
        const errMsg = err instanceof Error ? err.message : String(err)
        errors.push(`Order #${order.orderNumber}: ${errMsg}`)
        logger.error('RECEIPT_REGEN', `Failed for order #${order.orderNumber}:`, err)
      }
    }

    logger.info('RECEIPT_REGEN', `Backfill completed: created=${created}, skipped=${skipped}, failed=${failed}`)

    return NextResponse.json({
      success: true,
      processed: paidOrders.length,
      created,
      skipped,
      failed,
      ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/receipts/regenerate', 'Napaka pri regeneriranju receipts')
  }
}

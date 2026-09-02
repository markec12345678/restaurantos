// ============================================
// POST /api/receipts/rebuild
// ============================================
// Rebuild vatBreakdown za obstoječe receipts ki imajo null/empty vatBreakdown.
//
// Test 4.3 odkril: 64 receipts vseh ima null vatBreakdown ker so bili
// ustvarjeni preden je bil stolpec dodan v bazo.
//
// Ta endpoint:
//   1. Najde vse receipts z empty vatBreakdown
//   2. Za vsakega pridobi Order + OrderItems
//   3. Izračuna vatBreakdown in posodobi Receipt
//
// Varnost: admin permission
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { toNum } from '@/lib/decimal'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // Get all receipts with empty vatBreakdown
    const receipts = await db.receipt.findMany({
      where: {
        OR: [
          { vatBreakdown: '' },
          { vatBreakdown: '{}' },
          { vatBreakdown: null as never },
        ],
      },
      select: { id: true, receiptNumber: true, orderId: true },
      take: 1000,
    })

    if (receipts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Vsi receipts že imajo vatBreakdown',
        processed: 0,
        updated: 0,
      })
    }

    let updated = 0
    let failed = 0
    const errors: string[] = []

    for (const receipt of receipts) {
      try {
        // Get order with items
        const order = await db.order.findUnique({
          where: { id: receipt.orderId },
          include: {
            orderItems: {
              include: { menuItem: { select: { vatRate: true } } },
            },
          },
        })

        if (!order) {
          failed++
          errors.push(`Receipt ${receipt.receiptNumber}: order not found`)
          continue
        }

        // Calculate vatBreakdown
        const vatBreakdown: Record<string, { base: number; vat: number }> = {}
        for (const oi of order.orderItems) {
          if (oi.voided) continue
          const vatRate = toNum(oi.vatRate) || toNum(oi.menuItem?.vatRate) || 22.0
          const rate = String(vatRate)
          const base = toNum(oi.price) * oi.quantity
          const vat = toNum(oi.vatAmount) > 0 ? toNum(oi.vatAmount) : (base * (vatRate / 100))
          if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0 }
          vatBreakdown[rate].base += base
          vatBreakdown[rate].vat += vat
        }

        // Update receipt
        await db.receipt.update({
          where: { id: receipt.id },
          data: {
            vatBreakdown: JSON.stringify(vatBreakdown),
          },
        })
        updated++
      } catch (err) {
        failed++
        const errMsg = err instanceof Error ? err.message : String(err)
        errors.push(`Receipt ${receipt.receiptNumber}: ${errMsg}`)
        logger.error('RECEIPT_REBUILD', `Failed for receipt ${receipt.receiptNumber}:`, err)
      }
    }

    logger.info('RECEIPT_REBUILD', `Completed: updated=${updated}, failed=${failed}`)

    return NextResponse.json({
      success: true,
      processed: receipts.length,
      updated,
      failed,
      ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/receipts/rebuild', 'Napaka pri rebuild-u receipts')
  }
}

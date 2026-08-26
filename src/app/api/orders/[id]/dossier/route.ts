// ============================================
// GET /api/orders/[id]/dossier — Order Dossier (POSR-style)
// ============================================
// Celovita časovnica naročila: artikli, voids, plačila, kuhinja, fiskal, tisk
// Združi vse podatke o naročilu na enem mestu za pregled in revizijo
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { toNum } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    // Pridobi vse povezane podatke v vzporednih poizvedbah
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [orderAny, checksAny, receiptsAny, kotDocumentsAny, auditLogsAny] = await Promise.all([
      db.order.findUnique({
        where: { id },
        include: {
          table: { select: { id: true, number: true, area: true } },
          employee: { select: { id: true, name: true } },
          guest: { select: { id: true, firstName: true, lastName: true, phone: true } } as any,
          diningOption: { select: { id: true, name: true, type: true } },
          deliveryInfo: true,
          orderItems: {
            include: {
              menuItem: { select: { id: true, name: true, image: true, allergens: true } },
              voidReason: { select: { id: true, name: true } },
              appliedDiscount: { select: { id: true, name: true, type: true, amount: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          courses: {
            include: {
              orderItems: { select: { id: true, menuItemName: true, quantity: true, status: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }) as Promise<any>,
      db.check.findMany({
        where: { orderId: id },
        include: {
          appliedDiscount: { select: { name: true, type: true, amount: true } },
          payments: {
            include: {
              giftCard: { select: { id: true, cardNumber: true } } as any,
              loyaltyAccount: { select: { id: true, customerName: true } },
              alternatePaymentType: { select: { name: true, code: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { checkNumber: 'asc' },
      }) as Promise<any>,
      db.receipt.findMany({
        where: { orderId: id },
        select: {
          id: true, receiptNumber: true, zoi: true, eor: true,
          fiscalVerified: true, fiscalStatus: true, isStorno: true, stornoOf: true,
          verificationDate: true, paymentMethod: true,
          subtotal: true, totalVat: true, total: true, tip: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }) as Promise<any>,
      db.kotDocument.findMany({
        where: { orderId: id },
        include: {
          employee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }) as Promise<any>,
      db.auditLog.findMany({
        where: { entityId: id },
        select: {
          id: true, action: true, userId: true,
          details: true, timestamp: true, ipAddress: true,
        },
        orderBy: { timestamp: 'asc' },
      }) as Promise<any>,
    ])

    if (!orderAny) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    const order = orderAny
    const checks = checksAny || []
    const receipts = receiptsAny || []
    const kotDocuments = kotDocumentsAny || []
    const auditLogs = auditLogsAny || []

    // Zgradi časovnico dogodkov
    const timeline: Array<{ timestamp: string; type: string; description: string; data?: unknown }> = []

    // Order creation
    timeline.push({
      timestamp: new Date(order.createdAt).toISOString(),
      type: 'order_created',
      description: `Naročilo #${order.orderNumber} ustvarjeno`,
      data: { type: order.type, table: order.table?.number, employee: order.employee?.name },
    })

    // Order fired
    if (order.firedAt) {
      timeline.push({
        timestamp: new Date(order.firedAt).toISOString(),
        type: 'order_fired',
        description: `Naročilo poslano v kuhinjo`,
      })
    }

    // KOT documents
    for (const kot of kotDocuments) {
      const typeLabels: Record<string, string> = {
        original: 'KOT izdan',
        modified: 'KOT spremenjen',
        partially_cancelled: 'KOT delno preklican',
        cancelled: 'KOT preklican',
      }
      timeline.push({
        timestamp: new Date(kot.createdAt).toISOString(),
        type: `kot_${kot.type}`,
        description: `${typeLabels[kot.type] || 'KOT'} #${kot.kotNumber}`,
        data: { employee: kot.employee?.name, reason: kot.cancelReason },
      })
    }

    // Order item status changes
    for (const item of order.orderItems) {
      if (item.voided) {
        timeline.push({
          timestamp: new Date(item.updatedAt).toISOString(),
          type: 'item_voided',
          description: `Artikel voidan: ${item.menuItemName || item.menuItem?.name} (${item.quantity}x)`,
          data: { reason: item.voidReason?.name, itemId: item.id },
        })
      }
    }

    // Payment events
    for (const check of checks) {
      for (const payment of check.payments) {
        timeline.push({
          timestamp: new Date(payment.createdAt).toISOString(),
          type: payment.status === 'refunded' ? 'payment_refunded' : 'payment_received',
          description: `Plačilo ${payment.type} €${toNum(payment.amount).toFixed(2)}` +
            (payment.status === 'refunded' ? ` (povrnjeno €${toNum(payment.refundAmount).toFixed(2)})` : ''),
          data: {
            checkNumber: check.checkNumber,
            giftCard: payment.giftCard?.code,
            loyaltyAccount: payment.loyaltyAccount?.customerName,
          },
        })
      }
    }

    // Receipt / FURS events
    for (const receipt of receipts) {
      timeline.push({
        timestamp: new Date(receipt.createdAt).toISOString(),
        type: receipt.isStorno ? 'receipt_storno' : 'receipt_created',
        description: `Račun #${receipt.receiptNumber} ${receipt.isStorno ? '(storno)' : ''}`,
        data: {
          zoi: receipt.zoi?.slice(0, 16) + '...',
          eor: receipt.eor?.slice(0, 16) + '...' || null,
          fiscalVerified: receipt.fiscalVerified,
          fiscalStatus: receipt.fiscalStatus,
        },
      })
      if (receipt.verificationDate) {
        timeline.push({
          timestamp: new Date(receipt.verificationDate).toISOString(),
          type: 'furs_verified',
          description: `FURS overitev ${receipt.fiscalVerified ? '✅' : '❌'}`,
          data: { eor: receipt.eor?.slice(0, 16) + '...' },
        })
      }
    }

    // Audit log entries
    for (const log of auditLogs) {
      timeline.push({
        timestamp: new Date(log.timestamp).toISOString(),
        type: 'audit',
        description: log.action,
        data: { userId: log.userId, details: log.details ? JSON.parse(log.details) : null },
      })
    }

    // Order paid
    if (order.paidAt) {
      timeline.push({
        timestamp: new Date(order.paidAt).toISOString(),
        type: 'order_paid',
        description: `Naročilo plačano`,
      })
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Summary
    const orderItemsList = (order?.orderItems as Array<Record<string, unknown>>) || []
    const summary = {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      type: order.type,
      tableNumber: order.table?.number,
      employeeName: order.employee?.name,
      guestName: order.guest?.name,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      firedAt: order.firedAt,
      total: toNum(order.total),
      tip: toNum(order.tip),
      itemCount: orderItemsList.filter(i => !i.voided).length,
      voidedCount: orderItemsList.filter(i => i.voided).length,
      checkCount: checks.length,
      paymentCount: checks.flatMap((c: Record<string, unknown>) => (c.payments as Array<unknown>) || []).length,
      receiptCount: receipts.length,
      kotCount: kotDocuments.length,
      auditLogCount: auditLogs.length,
      isFiscalized: receipts.some((r: Record<string, unknown>) => r.fiscalVerified),
      isStorno: receipts.some((r: Record<string, unknown>) => r.isStorno),
    }

    return NextResponse.json({
      summary,
      order: deepToNumbers(order),
      checks: deepToNumbers(checks),
      receipts: deepToNumbers(receipts),
      kotDocuments: deepToNumbers(kotDocuments),
      auditLogs: deepToNumbers(auditLogs),
      timeline,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/orders/[id]/dossier', 'Napaka pri pridobivanju dosjeja naročila')
  }
}

// ============================================
// POST /api/accounting/journal/regenerate
// ============================================
// Backfill manjkajočih journal entries za obstoječa plačila.
//
// Scenarij: generateJournalForPayment je non-blocking (.catch()) in
// nekatere so tiho fail-ale. Ta endpoint omogoča admin-u da ročno
// regenerira journal entries za plačila ki jih manjkajo.
//
// Body:
//   { "paymentId": "..." }     — regeneriraj za 1 plačilo
//   { "afterDate": "2026-..." } — regeneriraj za vsa plačila po datumu
//   { "all": true }             — regeneriraj za VSA plačila (dangerous!)
//
// Varnost: zahteva admin permission
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { generateJournalForPayment } from '@/lib/accounting/journal-generator'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel: max 60s

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const { paymentId, afterDate, all } = body as {
      paymentId?: string
      afterDate?: string
      all?: boolean
    }

    if (!paymentId && !afterDate && !all) {
      return NextResponse.json(
        { error: 'Posredujte paymentId, afterDate, ali all=true' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: Record<string, unknown> = { status: 'completed' }
    if (paymentId) {
      where.id = paymentId
    } else if (afterDate) {
      where.createdAt = { gte: new Date(afterDate) }
    }

    // Get payments (with check → order relation for orderId)
    const payments = await db.payment.findMany({
      where,
      select: {
        id: true,
        checkId: true,
        createdAt: true,
        check: { select: { orderId: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: all ? 1000 : 100, // Limit za varnost
    })

    if (payments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Ni plačil za obdelavo',
        processed: 0,
        created: 0,
        skipped: 0,
        failed: 0,
      })
    }

    // Get existing journal entries (referenceType='payment')
    const existingEntries = await db.journalEntry.findMany({
      where: {
        referenceType: 'payment',
        reference: { in: payments.map(p => p.id) },
      },
      select: { reference: true },
    })
    const existingPaymentIds = new Set(existingEntries.map(e => e.reference))

    let created = 0
    let skipped = 0
    let failed = 0
    const errors: string[] = []

    for (const payment of payments) {
      // Skip če že obstaja journal entry
      if (existingPaymentIds.has(payment.id)) {
        skipped++
        continue
      }

      try {
        const orderId = payment.check?.orderId
        if (!orderId) {
          failed++
          errors.push(`Payment ${payment.id}: no orderId (check missing)`)
          continue
        }

        const entryId = await generateJournalForPayment(
          orderId,
          payment.id,
          authResult.session?.employeeId
        )
        if (entryId) {
          created++
        } else {
          failed++
          errors.push(`Payment ${payment.id}: generateJournalForPayment returned null`)
        }
      } catch (err) {
        failed++
        const errMsg = err instanceof Error ? err.message : String(err)
        errors.push(`Payment ${payment.id}: ${errMsg}`)
        logger.error('JOURNAL_REGEN', `Failed for payment ${payment.id}:`, err)
      }
    }

    logger.info('JOURNAL_REGEN', `Backfill completed: created=${created}, skipped=${skipped}, failed=${failed}`)

    return NextResponse.json({
      success: true,
      processed: payments.length,
      created,
      skipped,
      failed,
      ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/accounting/journal/regenerate', 'Napaka pri regeneriranju journal entries')
  }
}

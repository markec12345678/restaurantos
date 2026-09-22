// Pomožne funkcije za End-of-Day API — Zaključi izmeno (POST transakcija)

import { db, createAuditLog } from '@/lib/db'
import { toNum, sumBy, round2, add, subtract } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { createScheduledEmailLog } from '@/lib/email'

// ─── Zaključi izmeno (POST transakcija) ─────────────────────

export async function closeShift(
  date: string,
  actualCash: number | null | undefined,
  notes: string | null | undefined,
  locationId: string | null | undefined,
  employeeId: string | null | undefined,
) {
  // FIX BUG-3 CRITICAL: Zaključi izmeno ZNOTRAJ transakcije — prepreči double-close race condition
  const cashDiff = await db.$transaction(async (tx) => {
    // FIX CRITICAL: Dodaj locationId filter — brez tega več lokacij povzroči napačne izračune
    const shiftWhere: Record<string, unknown> = { status: 'open' }
    if (locationId) shiftWhere.locationId = locationId
    const activeShift = await tx.cashRegisterShift.findFirst({
      where: shiftWhere,
      orderBy: { openedAt: 'desc' },
    })

    if (!activeShift) return null

    // FIX BUG-5 CRITICAL: Izračunaj cashSales iz ACTUAL plačil, NE shift.cashSales (=0 za odprto izmeno)
    // FIX CRITICAL: Dodaj locationId filter na naročila — prepreči cross-location kontaminacijo
    const paidOrdersInShift = await tx.order.findMany({
      where: {
        paymentStatus: 'paid',
        paidAt: { gte: activeShift.openedAt },
        ...(activeShift.locationId ? { locationId: activeShift.locationId } : {}),
      },
      select: {
        discount: true,
        checks: {
          select: {
            payments: {
              where: { status: 'completed' },
              select: { type: true, amount: true, tipAmount: true, refundAmount: true },
            },
          },
        },
      },
    })

    const allPayments = paidOrdersInShift.flatMap(o => o.checks.flatMap(c => c.payments))
    // BUG-HUNT FIX 2026-09-19 (refund netting): neto zneski (amount − refundAmount)
    // — isti vzorec kot netPaymentAmount pri zaprtju izmene prek /api/cash-register.
    // Prej so EOD izračuni uporabljali BRUTO zneske → delni povračila so napihnila
    // expectedCash → lažni denarni primanjkljaj ob zaključku dneva.
    const netOf = (p: (typeof allPayments)[number]) => Math.max(0, toNum(p.amount) - toNum(p.refundAmount))
    const cashSales = toNum(sumBy(allPayments.filter(p => p.type === 'cash'), netOf))
    const cardSales = toNum(sumBy(allPayments.filter(p => p.type === 'card'), netOf))
    const mobileSales = toNum(sumBy(allPayments.filter(p => p.type === 'mobile'), netOf))
    const alternateSales = toNum(sumBy(allPayments.filter(p => ['voucher', 'loyalty', 'giftcard', 'alternate'].includes(p.type)), netOf))
    const totalSales = toNum(sumBy(allPayments, netOf))
    const totalDiscounts = toNum(sumBy(paidOrdersInShift, o => o.discount))
    const totalTips = toNum(sumBy(allPayments, p => p.tipAmount))
    const totalOrders = paidOrdersInShift.length
    const cashTips = toNum(sumBy(allPayments.filter(p => p.type === 'cash'), p => p.tipAmount))
    const expectedCash = round2(add(add(activeShift.startingCash, cashSales), cashTips))

    // FIX BUG-2 HIGH: Storno naročila za totalVoided
    const stornoOrdersInShift = await tx.order.findMany({
      where: {
        paymentStatus: 'storno',
        cancelledAt: { gte: activeShift.openedAt },
        ...(activeShift.locationId ? { locationId: activeShift.locationId } : {}),
      },
      select: { id: true, total: true },
    })
    const totalVoided = toNum(sumBy(stornoOrdersInShift, o => o.total))

    const closingCash = actualCash ?? expectedCash
    const cashDifference = round2(subtract(closingCash, expectedCash))

    // FIX R110 (EOD-1, HIGH — TOCTOU double-close, isti razred kot R104 C1):
    // prejšnji NEPOGOJEN update({ where: { id: activeShift.id } }) je dovolil,
    // da sta dva sočasna EOD POST-a OBADVA prebrala status 'open' (findFirst
    // znotraj tx NE ščiti pod READ COMMITTED — oba prebita do pisanja) →
    // drugi EOD je PREPIŠAL finančne agregate prvega (cashSales/expectedCash/
    // cashDifference iz DRUGAČNEGA snapshot-a plačil = last-writer-wins na
    // Z-poročilu), DUPLICIRAL EOD_COMPLETED audit log in DVAKRAT sprožil
    // finalizacijo Z-poročila. Sedaj: pogojni updateMany
    // (where { id, status: 'open' }) je avtoritativna vrata — samo PRVI EOD
    // preide (count=1); konkurenčni EOD dobi count=0 → return null → ruta
    // spoštljivo javi "izmena že zaprta" (idempotentna veja, brez dup audit/
    // finalize). Vzorec: R100 atomic counter CAS / R104 C1 parity.
    const casClose = await tx.cashRegisterShift.updateMany({
      where: { id: activeShift.id, status: 'open' },
      data: {
        closedAt: new Date(),
        closingCash,
        expectedCash,
        cashDifference,
        cashSales,
        cardSales,
        mobileSales,
        alternateSales,
        totalSales,
        totalOrders,
        totalDiscounts,
        totalTips,
        totalVoided,
        notes: notes || '',
        status: 'closed',
      },
    })
    if (casClose.count === 0) {
      // IZGUBLJENA tekma: izmena je bila zaprta med branjem in pisanjem.
      // return null = ista pogodba kot "ni odprte izmene" — ruta ne piše
      // audit loga ne finalizira Z-poročila za tuj (že stari) zaključek.
      return null
    }

    return { cashDifference, shiftId: activeShift.id }
  })

  // FIX CRITICAL: Prejšnja koda je vrnila success tudi ko ni bilo odprte izmene
  if (!cashDiff) {
    return null
  }

  // Zapiši EOD audit log
  await createAuditLog({
    action: 'EOD_COMPLETED',
    entityType: 'EndOfDay',
    details: {
      date,
      actualCash: actualCash ?? 0,
      notes: notes || '',
      closedBy: employeeId,
    } as Record<string, unknown>,
    userId: employeeId ?? undefined,
  })

  // AUD-12: Po uspešnem EOD sproži ScheduledEmailLog za z_report.
  // Non-blocking — napake ne smejo pokvariti EOD rezultata.
  // Samo če je email omogočen in imamo prejemnike (helper internalno preveri).
  try {
    const reportDate = date ? new Date(date) : new Date()
    if (Number.isNaN(reportDate.getTime())) {
      // Neveljaven datum — ne poskusi
      logger.warn('EOD', `Scheduled email skipped: neveljaven datum "${date}"`)
    } else {
      const result = await createScheduledEmailLog('z_report', reportDate)
      if (result.success) {
        if (result.skipped) {
          logger.info('EOD', `Scheduled email already exists: ${result.reason}`)
        } else {
          logger.info('EOD', `Scheduled email created: ${result.created} prejemnikov za ${result.reportDate}`)
        }
      } else {
        // Ni napaka — samo info (email morda ni konfiguriran)
        logger.info('EOD', `Scheduled email skipped: ${result.reason}`)
      }
    }
  } catch (emailError) {
    // Non-blocking: log + nadaljuj. EOD je že uspešno zaključen.
    const msg = emailError instanceof Error ? emailError.message : 'Neznana napaka'
    logger.error('EOD', `Scheduled email creation failed (non-blocking):`, msg)
  }

  return cashDiff
}

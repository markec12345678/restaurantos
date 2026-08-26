// Pomožne funkcije za End-of-Day API — Zaključi izmeno (POST transakcija)

import { db, createAuditLog } from '@/lib/db'
import { toNum, sumBy, round2, add, subtract } from '@/lib/decimal'

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
              select: { type: true, amount: true, tipAmount: true },
            },
          },
        },
      },
    })

    const allPayments = paidOrdersInShift.flatMap(o => o.checks.flatMap(c => c.payments))
    const cashSales = toNum(sumBy(allPayments.filter(p => p.type === 'cash'), p => p.amount))
    const cardSales = toNum(sumBy(allPayments.filter(p => p.type === 'card'), p => p.amount))
    const mobileSales = toNum(sumBy(allPayments.filter(p => p.type === 'mobile'), p => p.amount))
    const alternateSales = toNum(sumBy(allPayments.filter(p => ['voucher', 'loyalty', 'giftcard', 'alternate'].includes(p.type)), p => p.amount))
    const totalSales = toNum(sumBy(allPayments, p => p.amount))
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

    await tx.cashRegisterShift.update({
      where: { id: activeShift.id },
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

  return cashDiff
}

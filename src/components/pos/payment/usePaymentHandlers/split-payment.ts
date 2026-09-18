'use client'

import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type OrderForPayment, type PaymentExecContext } from './types'
import { splitAmountBreakdown } from '@/lib/split-math'
import { redeemPointsNeeded } from '@/lib/loyalty-tiers'

import { formatEUR } from '@/lib/safe-format'
// ============================================
// SPLIT PLAČILO
// ============================================

export async function executeSplitPayment({
  order,
  orderTotal,
  tipAmount,
  splitCount,
  paymentMethod,
  loyaltyAccountId,
  loyaltyRedeem,
  loyaltyBalance,
  pointsValue,
  queryClient,
  onPaymentSuccess,
  resetAndClose,
}: {
  order: OrderForPayment
  orderTotal: number
  tipAmount: number
  splitCount: number
  paymentMethod: string
  /** RUNDA 46: zvestobni račun za earn (vsako delno plačilo prisluži svoj del
   *  točk — enako semantiko kot posamezno plačilo); null = brez pripetega računa */
  loyaltyAccountId?: string | null
  /** RUNDA 49: unovčenje — vsako delno plačilo gre kot type 'loyalty' s točkami
   *  za svoj del zneska (parity z Eno plačilo). Tipa 'loyalty' backend NAMERNO
   *  ne nagradi z earn (handleLoyaltyEarn izpusti type==='loyalty'). */
  loyaltyRedeem?: boolean
  /** RUNDA 49: stanje izbranega računa — predhodna odjava preverjanje PRED
   *  prvim delnim plačilom (prepreči pol-failed split: gost 1 unovči, gost 2
   *  pada na "Ni dovolj točk"). null = preverjanje izpusti (backend varovalka). */
  loyaltyBalance?: number | null
  /** RUNDA 49: vrednost točke v EUR (> 0, normalizirano v usePaymentDialog) */
  pointsValue?: number
} & PaymentExecContext) {
  // FIX BUG-04: Prepreči podvojene čeke — ponovno uporabi obstoječi neplačani ček
  let splitCheckId: string | undefined
  const existingSplitChecksRes = await authFetch(`/api/checks?orderId=${order.id}&paymentStatus=unpaid`)
  if (existingSplitChecksRes.ok) {
    const checksData = await existingSplitChecksRes.json()
    const unpaidCheck = checksData.checks?.find((c: { paymentStatus: string }) => c.paymentStatus === 'unpaid')
    if (unpaidCheck) {
      splitCheckId = unpaidCheck.id
    }
  }
  if (!splitCheckId) {
    const checkRes = await authFetch('/api/checks', {
      method: 'POST',
      body: JSON.stringify({
        orderId: order.id,
        // FIX TypeError: t?.filter — order.orderItems je lahko undefined
        orderItemIds: (Array.isArray(order?.orderItems) ? order.orderItems : []).map(oi => oi.id),
      }),
    })
    if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
    const checkData = await checkRes.json()
    splitCheckId = checkData.id
  }
  const check = { id: splitCheckId }
  // 2. Ustvari N ločenih plačil (zadnje absorbira razliko za zaokroževanje)
  // RUNDA 49: razdelitev prek deljenega lib-a (split-math) — ista matematika
  // kot UI preview (prej sta dve kopiji, ki sta se lahko razhodili).
  const amounts = splitAmountBreakdown(orderTotal, splitCount)
  const payments: { amount: number; tipPortion: number }[] = []
  for (let i = 0; i < splitCount; i++) {
    const tipPortion = i === splitCount - 1
      ? Math.round((tipAmount - Math.round((tipAmount / splitCount) * 100) / 100 * (splitCount - 1)) * 100) / 100
      : Math.round((tipAmount / splitCount) * 100) / 100
    payments.push({ amount: amounts[i], tipPortion })
  }
  // RUNDA 49: unovčenje — pred PRVIM delnim plačilom preveri, da stanje
  // pokrije vsoto vseh delov (sicer bi gost 1 unovčil, gost 2 pa padel na
  // "Ni dovolj točk" — pol plačan račun). Vsota točk = Σ ceil(del / vrednost)
  // — enaka matematika kot bo uporabil backend fraud-check per del.
  const redeemActive = !!loyaltyRedeem && !!loyaltyAccountId && (pointsValue ?? 0) > 0
  const redeemPointsTotal = redeemActive
    ? payments.reduce((sum, p) => sum + redeemPointsNeeded(p.amount, pointsValue as number), 0)
    : 0
  if (redeemActive && typeof loyaltyBalance === 'number' && loyaltyBalance < redeemPointsTotal) {
    throw new Error(
      `Račun ima ${loyaltyBalance} točk, unovčenje zahteva ${redeemPointsTotal} — plačilo preklicano.`,
    )
  }
  for (let i = 0; i < payments.length; i++) {
    const paymentRes = await authFetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        checkId: check.id,
        amount: payments[i].amount,
        tipAmount: payments[i].tipPortion,
        // RUNDA 49: ob unovčenju je vsak del type 'loyalty' (backend sproži
        // dedukcijo točk; earn za ta plačila namerno ne teče)
        type: redeemActive
          ? 'loyalty'
          : paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : paymentMethod === 'mobile' ? 'mobile' : paymentMethod === 'split' ? 'split' : 'cash',
        idempotencyKey: `split-${check.id}-s${i}-${payments[i].amount.toFixed(2)}`,
        // RUNDA 46: earn točk tudi ob deljenem plačilu (prej tiho izgubljeno)
        // RUNDA 49: ob unovčenju še število točk za TA del (ceil — vedno pokrije)
        ...(redeemActive ? { loyaltyPointsUsed: redeemPointsNeeded(payments[i].amount, pointsValue as number) } : {}),
        ...(loyaltyAccountId ? { loyaltyAccountId } : {}),
      }),
    })
    if (!paymentRes.ok) throw new Error(`Napaka pri ustvarjanju plačila ${i + 1}`)
  }
  // 3. Posodobi naročilo
  // P2-UX FIX (stale order): pošlji expectedUpdatedAt (optimistic locking) —
  // glej useProcessPayment za podrobnosti.
  const orderRes = await authFetch(`/api/orders/${order.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      paymentStatus: 'paid',
      paymentMethod: 'split',
      ...(order.status === 'ready' ? { status: 'completed' } : {}),
      tip: tipAmount,
      totalWithTip: orderTotal + tipAmount,
      ...(order.updatedAt ? { expectedUpdatedAt: order.updatedAt } : {}),
    }),
  })
  if (!orderRes.ok) throw new Error('Napaka pri posodobitvi naročila')
  // FIX MEDIUM: Split payment — ustvari račun in FURS overitev
  try {
    const receiptRes = await authFetch(`/api/receipts/${order.id}`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'split', isStorno: false }),
    })
    if (receiptRes.ok) {
      // P2-UX FIX (prikaz neuspele fiskalizacije): prej se je odgovor 400 (fiskalizacija
      // ni uspela) tiho zavrnil — natakar ni izvedel, da EOR manjka.
      try {
        const fursRes = await authFetch('/api/furs', {
          method: 'POST',
          body: JSON.stringify({ orderId: order.id }),
        })
        const fursResult = await fursRes.json().catch(() => null)
        if (fursResult?.success && !fursResult.isSimulation) {
          toast.success('Račun davčno overjen (FURS)', { duration: 3000 })
        } else if (fursResult?.success && fursResult.isSimulation) {
          toast.info('Račun overjen (FURS simulacija)', { duration: 3000 })
        } else {
          toast.error(fursResult?.warning || fursResult?.error || 'Fiskalizacija ni uspela — ponovite davčno overitev.', { duration: 8000 })
        }
      } catch { toast.warning('FURS overitev ni uspela — račun je brez davčnega overjanja') }
    }
  } catch { /* Račun ni bil ustvarjen — plačilo je še vedno veljavno */ }
  toast.success(`Plačilo uspešno! ${splitCount}x ${formatEUR(orderTotal / splitCount)}`)
  queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.zReport.all }) // živi Z-osnutek (runda 11)
  queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
  queryClient.invalidateQueries({ queryKey: ['checks'] })
  if (onPaymentSuccess && order.id) onPaymentSuccess(order.id)
  resetAndClose()
}

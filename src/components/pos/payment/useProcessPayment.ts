'use client'

// ============================================
// PROCESS PAYMENT MUTATION — Check → Payment → Order → Receipt → FURS → Print
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRef } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

interface ProcessPaymentParams {
  order: {
    id: string
    total: number
    orderItems: { id: string }[]
    status?: string
  } | null
  orderTotal: number
  tipAmount: number
  paymentMethod: string
  selectedAltPayment: string
  selectedGiftCardId: string | null
  selectedLoyaltyId: string | null
}

interface ProcessPaymentCallbacks {
  onPaymentSuccess: (_orderId: string) => void
  onSetPaymentSuccess: (_success: boolean) => void
  scheduleClose: () => void
}

// ─── P0 FIX: Idempotency plačil ──────────────────────────────────────────────
// Generira UUID idempotencyKey, ki vztraja čez retry-je istega plačilnega namena.
//
// Zakaj ref in ne spremenljivka v mutationFn?
//   - React-Query mutationFn se izvede enkrat per .mutate() klic.
//   - Če bi generirali key znotraj mutationFn, bi double-click generiral dva
//     različna ključa → dve plačili. NAPAČNO.
//   - Z ref-om key generiramo OB PRVEM poskusu in vztraja, dokler ga eksplicitno
//     ne počistimo (resetPaymentIntent). Vsi retry-i istega namena uporabijo
//     isti key → backend vrne obstoječe plačilo (idempotent).
//
// Življenjski cikel:
//   1. Uporabnik odpre PaymentDialog → ref = null
//   2. Klik "Plačaj" → mutationFn teče, generira key v ref, pošlje na backend
//   3a. USPEH → toast, dialog se zapre, resetPaymentIntent() počisti ref
//   3b. NAPAKA (npr. prekinitev omrežja) → ref OBDRŽI key.
//       Uporabnik klikne "Plačaj" znova → ista mutationFn, ista ref, ISTI key.
//       Backend vrne obstoječe plačilo (200) če je prvi poskus dejansko uspel,
//       ali ustvari novo (201) če prvi poskus ni prišel do baze. Oba primera
//       pravilna — NIKOLI dvojno plačilo.
function generateIdempotencyKey(): string {
  // Enostaven, a zadostno unikaten ključ za idempotency. Ker se generira
  // samo ob prvem poskusu (useRef) in vztraja čez retry-je, zadostuje
  // timestamp + naključni del. Brez crypto global (izogne se DOM/Node type
  // ambiguiteti in browser compatibility skrbinam).
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function useProcessPayment(params: ProcessPaymentParams, callbacks: ProcessPaymentCallbacks) {
  const queryClient = useQueryClient()

  // P0 FIX: idempotencyKey vztraja čez retry-je istega plačilnega namena.
  // Ne generira se ob vsakem .mutate() — samo ob prvem poskusu. Počisti se
  // šele po uspehu (resetPaymentIntent), tako da retry po napaki uporabi isti key.
  const idempotencyKeyRef = useRef<string | null>(null)

  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      const { order, orderTotal, tipAmount, paymentMethod, selectedAltPayment, selectedGiftCardId, selectedLoyaltyId } = params
      if (!order) return null

      // P0 FIX: Generiraj idempotencyKey ob prvem poskusu; ohrani pri retry-ih.
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = generateIdempotencyKey()
      }
      const idempotencyKey = idempotencyKeyRef.current

      // FIX BUG-04: Prepreči podvojene čeke — ponovno uporabi obstoječi neplačani ček
      let checkId: string | undefined
      const existingChecksRes = await authFetch(`/api/checks?orderId=${order.id}&paymentStatus=unpaid`)
      if (existingChecksRes.ok) {
        const checksData = await existingChecksRes.json()
        const unpaidCheck = checksData.checks?.find((c: { paymentStatus: string }) => c.paymentStatus === 'unpaid')
        if (unpaidCheck) {
          checkId = unpaidCheck.id
        }
      }
      if (!checkId) {
        const checkRes = await authFetch('/api/checks', {
          method: 'POST',
          body: JSON.stringify({
            orderId: order.id,
            orderItemIds: order.orderItems.map(oi => oi.id),
          }),
        })
        if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
        const checkData = await checkRes.json()
        checkId = checkData.id
      }
      const check = { id: checkId }

      // 2. Ustvari Payment za Check — P0 FIX: pošlji idempotencyKey
      // Backend bo za isti key vrnil obstoječe plačilo (200) namesto novega (201),
      // tudi če dvakrat prideta (double-click, retry, reconnect). Nikoli dvojno plačilo.
      const paymentRes = await authFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          checkId: check.id,
          amount: orderTotal,
          tipAmount: tipAmount,
          type: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : paymentMethod === 'mobile' ? 'mobile' : paymentMethod === 'giftcard' ? 'giftcard' : paymentMethod === 'loyalty' ? 'loyalty' : paymentMethod === 'alternate' ? 'alternate' : paymentMethod === 'split' ? 'split' : 'cash',
          alternatePaymentTypeId: paymentMethod === 'alternate' ? selectedAltPayment : null,
          giftCardId: paymentMethod === 'giftcard' ? selectedGiftCardId : null,
          loyaltyAccountId: paymentMethod === 'loyalty' ? selectedLoyaltyId : null,
          loyaltyPointsUsed: paymentMethod === 'loyalty' && selectedLoyaltyId ? Math.round(orderTotal) : 0,
          idempotencyKey,
        }),
      })
      // Idempotentni backend: tudi če je status 200 (obstoječe plačilo) ali 201 (novo),
      // je paymentRes.ok true za oba. Napaka (400/500) pomeni pravo neuspeh — throw.
      if (!paymentRes.ok) throw new Error('Napaka pri ustvarjanju plačila')

      // 3. Posodobi naročilo
      const orderRes = await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          paymentStatus: 'paid',
          paymentMethod: paymentMethod === 'split' ? 'split' : paymentMethod,
          ...(order.status === 'ready' ? { status: 'completed' } : {}),
          tip: tipAmount,
          totalWithTip: orderTotal + tipAmount,
        }),
      })
      if (!orderRes.ok) throw new Error('Napaka pri posodobitvi naročila')
      const updatedOrder = await orderRes.json()

      // ─── AUTO-RECEIPT: Avtomatsko ustvari račun v bazi ───
      try {
        const receiptRes = await authFetch(`/api/receipts/${order.id}`, {
          method: 'POST',
          body: JSON.stringify({
            paymentMethod: paymentMethod === 'split' ? 'split' : paymentMethod,
            isStorno: false,
          }),
        })
        if (receiptRes.ok) {
          const _receipt = await receiptRes.json()
          // ─── AUTO-FURS: Avtomatsko davčno overi račun ───
          try {
            const fursRes = await authFetch('/api/furs', {
              method: 'POST',
              body: JSON.stringify({ orderId: order.id }),
            })
            const fursResult = fursRes.ok ? await fursRes.json() : null
            if (fursResult?.success && !fursResult.isSimulation) {
              toast.success('Račun davčno overjen (FURS)', { duration: 3000 })
            } else if (fursResult?.success && fursResult.isSimulation) {
              toast.info('Račun overjen (FURS simulacija)', { duration: 3000 })
            }
          } catch {
            toast.warning('FURS overitev ni uspela, račun je brez davčnega overjanja')
          }
          // ─── AUTO-PRINT: Avtomatsko tiskaj na termični tiskalnik ───
          try {
            await authFetch('/api/print', {
              method: 'POST',
              body: JSON.stringify({ type: 'receipt', orderId: order.id }),
            })
            toast.info('Račun poslan na tiskalnik', { duration: 2000 })
          } catch {
            toast.warning('Tiskanje ni uspelo')
          }
        }
      } catch {
        toast.warning('Napaka pri ustvarjanju računa')
        toast.warning('Plačilo uspešno, vendar račun ni bil samodejno ustvarjen. Ustvarite ga ročno.')
      }
      return updatedOrder
    },
    onSuccess: (data) => {
      toast.success('Plačilo uspešno obdelano!')
      // P0 FIX: Po uspehu počisti idempotencyKey — naslednje plačilo dobi nov key.
      idempotencyKeyRef.current = null
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
      queryClient.invalidateQueries({ queryKey: ['checks'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.menuStock })
      if (callbacks.onPaymentSuccess && data?.id) {
        callbacks.onPaymentSuccess(data.id)
      }
      callbacks.onSetPaymentSuccess(true)
      callbacks.scheduleClose()
    },
    onError: () => {
      // P0 FIX: NE čistimo idempotencyKeyRef tukaj!
      // Če je plačilo morda uspelo na backendu (npr. prekinitev omrežja po insertu,
      // preden je klient prejel odgovor), mora retry z istim keyjem dobiti obstoječe
      // plačilo (idempotent 200). Če bi počistili key, bi retry ustvaril duplikat.
      toast.error('Napaka pri obdelavi plačila')
    },
  })

  return { processPaymentMutation }
}

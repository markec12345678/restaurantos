'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { KioskCartItem, KioskMenuItem, SelectedModifier } from './types'
import { createIdempotencyKey } from './kiosk-context'

// =====================================================================
// HOOK: košarica kioska + oddaja naročila (POST /api/public/kiosk)
//  - košarica je V POMNILNIKU (useState) — refresh NAMERNO resetira
//    (kiosk je anonimna javna naprava; brez persistanse, brez osebnih podatkov)
//  - združevanje po ključu artikel+modifierji (isti vzorec kot
//    useOnlineOrder/cart-utils addToCartLogic)
//  - izračuni po kanonu P1-8 (zrcalita buildOrderItemsData/calculateOrderTotals):
//    enota = round2(neto + Σ modifierji) → postavka = round2(enota × qty)
//    → DDV postavke = round2(osnova × vatRate/100) → total = Σ osnova + Σ DDV
//  - idempotencyKey: NOV ob vstopu v checkout (beginCheckout), PONOVLJEN pri
//    avtomatskem retry-u istega submissiona; uspeh/nova oddaja → nov ključ
//  - brez console.log (hišno pravilo) — tiche catch bloki kot api-helpers
// =====================================================================

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** GROSS prikazna cena (NETO × (1 + DDV/100)) — ist formula kot order/qr-menu */
export function grossPrice(neto: number, vatRate: number): number {
  return neto * (1 + vatRate / 100)
}

/** Zneski postavke košarice (neto osnova, DDV, bruto) — kanon P1-8 */
export function lineAmounts(item: KioskCartItem): { net: number; vat: number; total: number } {
  const unit = round2(item.netoPrice + item.modifiers.reduce((s, m) => s + (m.price || 0), 0))
  const net = round2(unit * item.quantity)
  const vat = round2(net * (item.vatRate / 100))
  return { net, vat, total: round2(net + vat) }
}

function cartKey(menuItemId: string, modifiers: SelectedModifier[]): string {
  return `${menuItemId}-${modifiers.map(m => m.id).sort().join(',')}`
}

export type SubmitOutcome =
  | { kind: 'success'; orderNumber: number; total: number; paymentMethod: string; message: string }
  | { kind: 'unavailable'; unavailable: { menuItemId: string; name: string }[] }
  | { kind: 'closed'; error: string }
  | { kind: 'config-error' }
  | { kind: 'rate-limited' }
  | { kind: 'error'; error: string }

export interface SubmitContext {
  locationId: string
  token: string
  deviceId: string
  diningOption: 'dine-in' | 'takeout'
  tableNumber: string
  paymentMethod: 'card' | 'cash'
}

export function useKioskCart() {
  const [cart, setCart] = useState<KioskCartItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  // Ključ trenutnega submissiona — ref (ne triggera re-renderov)
  const idempotencyKeyRef = useRef('')

  /** Ob vstopu v checkout / po spremembi košarice: NOV ključ (nova oddaja) */
  const beginCheckout = useCallback(() => {
    idempotencyKeyRef.current = createIdempotencyKey()
  }, [])

  const add = useCallback((item: KioskMenuItem, modifiers: SelectedModifier[] = []) => {
    setCart(prev => {
      const key = cartKey(item.id, modifiers)
      const existing = prev.findIndex(c =>
        cartKey(c.menuItemId, c.modifiers) === key
      )
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], quantity: Math.min(99, updated[existing].quantity + 1) }
        return updated
      }
      return [...prev, {
        menuItemId: item.id,
        name: item.name,
        netoPrice: item.price,
        vatRate: item.vatRate,
        quantity: 1,
        modifiers,
        notes: '',
      }]
    })
  }, [])

  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev]
      const next = (updated[index]?.quantity ?? 0) + delta
      if (next <= 0) return prev.filter((_, i) => i !== index)
      updated[index] = { ...updated[index], quantity: Math.min(99, next) }
      return updated
    })
  }, [])

  const remove = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }, [])

  const setNote = useCallback((index: number, note: string) => {
    setCart(prev => {
      if (!prev[index]) return prev
      const updated = [...prev]
      updated[index] = { ...updated[index], notes: note.slice(0, 200) }
      return updated
    })
  }, [])

  /** 400 z unavailableItems: odstrani vse postavke teh artiklov iz košarice */
  const removeByIds = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setCart(prev => prev.filter(c => !idSet.has(c.menuItemId)))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  // --- Izpeljane vrednosti (kanon P1-8, brez popustov) ---
  const totals = useMemo(() => {
    let itemCount = 0
    let subtotalNet = 0
    let vat = 0
    for (const item of cart) {
      const la = lineAmounts(item)
      itemCount += item.quantity
      subtotalNet = round2(subtotalNet + la.net)
      vat = round2(vat + la.vat)
    }
    return { itemCount, subtotalNet, vat, total: round2(subtotalNet + vat) }
  }, [cart])

  const submitOrder = useCallback(async (ctx: SubmitContext): Promise<SubmitOutcome> => {
    if (cart.length === 0) return { kind: 'error', error: 'Košarica je prazna.' }
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = createIdempotencyKey()

    const orderItems = cart.map(item => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      notes: item.notes ? item.notes.slice(0, 200) : '',
      // Isti format kot online-order: JSON array { name, price } (≤2000)
      modifiersJson: JSON.stringify(item.modifiers.map(m => ({ name: m.name, price: m.price }))),
    }))

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/public/kiosk?locationId=${encodeURIComponent(ctx.locationId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderItems,
            diningOption: ctx.diningOption,
            // tableNumber samo za dine-in (schema ≤10 znakov)
            tableNumber: ctx.diningOption === 'dine-in' && ctx.tableNumber.trim()
              ? ctx.tableNumber.trim().slice(0, 10)
              : undefined,
            // customerName se NE pošilja → strežniški default 'Kiosk'
            paymentMethod: ctx.paymentMethod,
            // R88/R135 kanon: per-lokacijski ordering token (deep link ?t=)
            orderingToken: ctx.token,
            // Vezava naprave (DeviceRegistry upsert) — samo če deviceId obstaja
            deviceId: ctx.deviceId || undefined,
            idempotencyKey: idempotencyKeyRef.current,
          }),
        },
      )

      // 429 rate limit — prijazen zaslon (retry z ISTIM ključem)
      if (res.status === 429) return { kind: 'rate-limited' }
      // 404 → token rotiran/neveljaven ALI lokacija izginila → config error
      if (res.status === 404) return { kind: 'config-error' }
      // 403 → restavracija zaprta → prijazen zaslon z "Poskusi znova"
      if (res.status === 403) {
        const closed: { error?: unknown } = await res.json().catch(() => ({}))
        return { kind: 'closed', error: typeof closed.error === 'string' ? closed.error : 'Restavracija je trenutno zaprta. Naročila niso mogoča.' }
      }
      if (res.status === 400) {
        const data: { error?: unknown; unavailableItems?: unknown } = await res.json().catch(() => ({}))
        // Izprodani artikli: { menuItemId, name }[] → odstrani iz košarice
        if (Array.isArray(data.unavailableItems) && data.unavailableItems.length > 0) {
          const unavailable = data.unavailableItems.flatMap(u => {
            if (!u || typeof u !== 'object') return []
            const rec = u as Record<string, unknown>
            if (typeof rec.menuItemId !== 'string' || typeof rec.name !== 'string') return []
            return [{ menuItemId: rec.menuItemId, name: rec.name }]
          })
          if (unavailable.length > 0) return { kind: 'unavailable', unavailable }
        }
        return { kind: 'error', error: typeof data.error === 'string' ? data.error : 'Neveljavni podatki. Preverite naročilo.' }
      }
      if (!res.ok) {
        return { kind: 'error', error: 'Napaka pri oddaji naročila. Poskusite znova.' }
      }

      // 201 (uspeh) / 200 (idempotentReplay) — ista oblika, oba = uspeh
      const data: Record<string, unknown> = await res.json().catch(() => ({}))
      if (data.success !== true || typeof data.orderNumber !== 'number') {
        return { kind: 'error', error: 'Nepričakovan odgovor strežnika. Poskusite znova.' }
      }
      return {
        kind: 'success',
        orderNumber: data.orderNumber,
        total: typeof data.total === 'number' ? data.total : 0,
        paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : '',
        message: typeof data.message === 'string' ? data.message : '',
      }
    } catch {
      // Omrežna napaka — retry gumba re-uporabi ISTI idempotencyKey
      return { kind: 'error', error: 'Napaka pri povezavi. Poskusite znova.' }
    } finally {
      setSubmitting(false)
    }
  }, [cart])

  return {
    cart,
    submitting,
    totals,
    add,
    updateQuantity,
    remove,
    setNote,
    removeByIds,
    clearCart,
    beginCheckout,
    submitOrder,
  }
}

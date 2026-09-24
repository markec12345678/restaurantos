// ============================================
// BOLT WEBHOOK HELPERS — Schema, mapping, utilities
// Bolt Food delivery platform (popular in Slovenia/Croatia/Baltics)
// ============================================

import { z } from 'zod'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// Bolt signature header name
export const BOLT_SIGNATURE_HEADER = 'x-bolt-signature'

// Bolt order schema — validacija vhodnega webhook payload-a
export const boltOrderSchema = z.object({
  order_id: z.string().min(1, 'Bolt order ID je obvezen'),
  status: z.string().default('pending'),
  created_at: z.string().optional(),
  pickup_time: z.string().optional(),

  // Stranka
  customer: z.object({
    name: z.string().default('Bolt stranka'),
    phone: z.string().default(''),
  }).default({ name: 'Bolt stranka', phone: '' }),

  // Dostava
  delivery_address: z.string().default(''),
  delivery_notes: z.string().default(''),
  delivery_fee: z.number().min(0).default(0),

  // Artikli
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().int().min(1),
    price: z.number().min(0), // cena v centih ali EUR (odvisno od Bolt API)
    notes: z.string().default(''),
    options: z.array(z.object({
      id: z.string().optional(),
      name: z.string(),
      price: z.number().min(0).default(0),
    })).default([]),
  })).min(1, 'Naročilo mora vsebovati vsaj en artikel'),

  // Skupni znesek
  total_price: z.number().min(0),
  currency: z.string().default('EUR'),
})

export type BoltOrderPayload = z.infer<typeof boltOrderSchema>

// Map Bolt artikli v RestaurantOS OrderItem
// FIX R112 (WEBHOOK-3, MED): klicatelj podaja SAMO lokacijsko-scoped seznam
// artiklov (category → menu → locationId veriga, glej bolt/route.ts) — prej
// je bila preslikava pognana nad globalnim seznamom VSEH artiklov in je
// lahko zadela artikel TUJEGA tenanta (napačna cena/DDV).
export function mapBoltItemsToOrderItems(
  items: BoltOrderPayload['items'],
  menuItems: Array<{ id: string; name: string; price: unknown; vatRate: unknown }>
) {
  return items.map((item, idx) => {
    // Poskusi najdi artikel po imenu (Bolt pošlja ime, ne ID-ja iz našega sistema)
    const menuItem = menuItems.find(mi =>
      mi.name.toLowerCase().includes(item.name.toLowerCase()) ||
      item.name.toLowerCase().includes(mi.name.toLowerCase())
    )

    // FIX R112 (WEBHOOK-4, MED): brez ujemanja zavrnemo — NI vec fallbacka na
    // menuItems[0] (prvi artikel katerega koli tenanta) in NI zaupanja wire
    // ceni iz Bolt payloada. Strukturirana 400 'Neznana pozicija' z imenom
    // artikla (isti { error, status } kontrakt kot structuredErrorResponse);
    // cena/DDV prihajajo izključno iz lokacijsko-scoped baze (WEBHOOK-3).
    if (!menuItem) {
      throw { error: `Neznana pozicija: ${item.name}`, status: 400 }
    }

    const optionsJson = JSON.stringify(
      item.options.map(opt => ({ name: opt.name, price: opt.price }))
    )

    return {
      menuItemId: menuItem.id,
      menuItemName: item.name,
      quantity: item.quantity,
      price: Number(menuItem.price),
      vatRate: Number(menuItem.vatRate),
      notes: item.notes || '',
      modifiersJson: optionsJson,
      sortOrder: idx,
    }
  })
}

// ─── Kanonska Bolt identiteta v customerName ─────────────────────────
// R117 (H-1, P1): customerName je edini nosilec Bolt order ID-ja za
// ZGODOVINSKA naročila (pred kanonskim integrationLog modelom). Delimiter
// ' — ' naredi legacy ujemanje prefix-varno: `Bolt:123 — ` NE ujame
// `Bolt:1234 — ...`. Route in helper uporabljata ISTO konstanto (ni drifta).
export const BOLT_CUSTOMER_TAG_DELIMITER = ' — '

export function buildBoltCustomerName(boltOrderId: string, customerName: string): string {
  return `Bolt:${boltOrderId}${BOLT_CUSTOMER_TAG_DELIMITER}${customerName}`
}

export function boltLegacyCustomerNamePrefix(boltOrderId: string): string {
  return `Bolt:${boltOrderId}${BOLT_CUSTOMER_TAG_DELIMITER}`
}

// Preveri ali Bolt naročilo že obstaja (idempotentnost)
//
// FIX R117 (H-1, P1): dedup je bil NESCOPEAN — order.findFirst nad
// customerName z substring ujemanjem 'Bolt:<id>' brez integracijske in
// lokacijske scope:
//   (a) `contains` je pometal prefix kolizije (iskanje 123 je ujelo
//       Bolt:1234) → legitimen webhook tiho pogoltnjen,
//   (b) je lahko vrnil/replay-al TUJE naročilo (druga integracija/lokacija)
//       → cross-tenant orderId/orderNumber leak,
//   (c) identiteta ni bila vezana na integracijo (dva Bolta = ista identita).
//
// Sedaj kanonski Wolt/Glovo model (integrationLog + EXACT provider
// identiteta + scoped integracija; glej wolt-mapping.ts / glovo-idempotency.ts):
//
//   1) PRIMARNO — integrationLog, scoped na { integrationId, action:
//      'order_received', direction: 'inbound', status: 'success' } +
//      EXACT JSON parse identiteta (data.boltOrderId === boltOrderId,
//      NIKOLI substring odločitev). Ista integracija + isti Bolt order_id
//      → replay; druga integracija + isti order_id → NI duplikat.
//   2) LEGACY FALLBACK — samo zgodovinski zapisi brez loga: order.findFirst
//      scoped na { locationId: webhookLocationId } + `startsWith`
//      `Bolt:<id> — ` (delimiter preprečuje 123/1234 kolizijo). Teče ŠELE,
//      ko kanonska identiteta ne najde ničesar → NIKOLI ne preglasi
//      integrationLog identitete. Pokriva tudi okno med tx commitom in
//      integrationLog zapisom pri sočasnih redeliverijah (pod advisory
//      lock-om — isti vloga kot Wolt notes fallback).
//
// Opcijski tx klient — AVTORITATIVNA preverba teče tx-fresh ZNOTRAJ
// transakcije pod advisory lock-om 'delivery-webhook:{integrationId}:{
// boltOrderId}' (R112 WEBHOOK-1 kanon, nespremenjen); brez klienta ostane
// hitri pregled nad db (samo fast-path, ni vezava).
export async function findExistingBoltOrder(
  boltOrderId: string,
  webhookLocationId: string,
  integrationId: string,
  client?: Prisma.TransactionClient,
): Promise<{ type: 'log' | 'order'; orderId: string | null; orderNumber: number | null } | null> {
  // R117: STATIC db import (isti vzorec kot wolt-mapping/glovo-idempotency) —
  // per-call dinamični import je pod sočasno redeliverijo (Promise.all dveh
  // webhookov) zgrešil mock/real razrešitev v VM testnem okolju; statični
  // import je determinističen.
  const dbClient = client ?? db

  // 1) Kanonska identiteta: integrationLog scoped na TO integracijo
  const candidateLogs = await dbClient.integrationLog.findMany({
    where: {
      integrationId,
      action: 'order_received',
      direction: 'inbound',
      status: 'success',
      OR: [
        { requestData: { contains: `"boltOrderId":"${boltOrderId}"` } },
        { requestData: { contains: `"boltOrderId": "${boltOrderId}"` } },
      ],
    },
    select: { requestData: true, responseData: true },
  })
  const exactLog = candidateLogs.find(log => {
    try {
      const data = JSON.parse(log.requestData || '{}')
      return data.boltOrderId === boltOrderId
    } catch { return false }
  })
  if (exactLog) {
    // Log obstaja = naročilo je bilo ustvarjeno (fail-closed proti
    // podvajanju — isti kontrakt kot Wolt/Glovo 'log' tip; okvarjen
    // responseData → null orderId, redelivery dobi 200 brez novega create-a).
    let orderId: string | null = null
    let orderNumber: number | null = null
    try {
      const resp = JSON.parse(exactLog.responseData || '{}')
      orderId = typeof resp.orderId === 'string' ? resp.orderId : null
      orderNumber = typeof resp.orderNumber === 'number' ? resp.orderNumber : null
    } catch { /* okvarjen responseData → null */ }
    return { type: 'log' as const, orderId, orderNumber }
  }

  // 2) LEGACY fallback (zgodovinski zapisi pred log modelom): lokacijsko
  // scoped + delimiter-exact prefix (startsWith, ne contains → 123 ne
  // ujame 1234). NIKOLI čez lokacijo webhook integracije.
  const legacyOrder = await dbClient.order.findFirst({
    where: {
      locationId: webhookLocationId,
      customerName: { startsWith: boltLegacyCustomerNamePrefix(boltOrderId) },
    },
    select: { id: true, orderNumber: true },
    orderBy: { createdAt: 'desc' },
  })
  if (legacyOrder) {
    return { type: 'order' as const, orderId: legacyOrder.id, orderNumber: legacyOrder.orderNumber }
  }
  return null
}

// POST handler za receipts/[id] — ustvarjanje računa v bazo

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextReceiptNumber } from '@/lib/counters'
import { createReceiptSchema, receiptCreatedResponseSchema } from '@/lib/validations'
import { parseJsonBody, validateBody, validateApiResponse } from '@/lib/api-utils'
import { toNum, round2, deepToNumbers } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { generateZOIPlaceholder, MINIMAL_SETTINGS, calculateVatBreakdownForReceipt } from './index'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'
import { submitReceiptToCis } from '@/lib/cis/receipt-submission'

export async function handlePostReceipt(
  req: Request,
  id: string,
  _authResult: { session?: { employeeId?: string; locationId?: string | null } | null },
) {
  // FIX R81-G (LEAK-HIGH, cross-tenant): order.findUnique je bil nescopecan —
  // manage_cash staff je lahko fiskaliziral TUJ naročilo (Receipt.create +
  // poraba številčne serije tuje lokacije). Order.locationId je NOT NULL —
  // findFirst z lokacijskim filtrom iz seje; izven scope-a → 404
  // notInScopeResponse (isti vzorec kot GET/PUT tukaj in P0-C1 transfer).
  // FIX R86-2a (M2 fail-open): centralni resolver namesto raw spread-a —
  // regularna NULL-location seja je prej lahko fiskalizirala naročilo KATEREGA
  // KOLI tenanta (številčna serija + FURS zoi/eor). Resolver teče TUKAJ (in ne
  // v route), ker tudi receipts/regenerate kliče ta handler z authResult.
  // FIX R87-4 (higiena, R86-FINAL-AUDIT LOW #3): resolver PRED body parse
  // (kanon: tables/merge, webhooks, purchase-orders); varno — requireAuth
  // bere samo headerje, authResult je že rezolviran s strani klicatelja.
  const { searchParams } = new URL(req.url)
  const scope = resolveTenantLocationIdOrThrow(_authResult.session, searchParams, {
    endpoint: 'POST /api/receipts/[id]',
  })
  if ('error' in scope) return scope.error

  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  // FIX H-01: Validiraj vnos z Zod
  const { data, error: validationError } = validateBody(createReceiptSchema, bodyResult.data)
  if (validationError) return validationError

  const order = await db.order.findFirst({
    where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    include: { orderItems: { include: { menuItem: true } } },
  })

  if (!order) {
    return notInScopeResponse('Naročilo')
  }

  // FIX: Preveri, da je naročilo plačano preden se ustvari račun
  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partial') {
    return NextResponse.json({ error: 'Naročilo mora biti plačano preden se ustvari račun' }, { status: 400 })
  }

  // Preveri če že obstaja
  const existing = await db.receipt.findFirst({ where: { orderId: id, isStorno: false } })
  if (existing) {
    return NextResponse.json(deepToNumbers(existing))
  }

  // FIX P0-C3A: Pridobi poslovne podatke iz Location (vezano na order.locationId)
  // Prej: settings.findFirst({isActive:true}) — globalno, v multi-tenant napačna lokacija
  // Sedaj: getRestaurantInfoForLocation(order.locationId) — pravi podatki za pravi račun
  // Ti podatki se snapshotnejo v Receipt row in trajno ostanejo v bazi.
  const info = await getRestaurantInfoForLocation(order.locationId)
  // Fallback na MINIMAL_SETTINGS če Location ne obstaja in settings tudi ne
  const s2 = info.source === 'location' || info.businessId || info.taxId
    ? {
        name: info.name || MINIMAL_SETTINGS.name,
        address: info.address || MINIMAL_SETTINGS.address,
        postCode: info.postCode || MINIMAL_SETTINGS.postCode,
        city: info.city || MINIMAL_SETTINGS.city,
        businessId: info.businessId || MINIMAL_SETTINGS.businessId,
        taxId: info.taxId || MINIMAL_SETTINGS.taxId,
        registerNumber: info.registerNumber || MINIMAL_SETTINGS.registerNumber,
      }
    : MINIMAL_SETTINGS

  // Izračunaj DDV razdelitev (strežniško — edini vir resnice)
  const totalDiscount = toNum(order.discount)
  const vatBreakdownForReceipt = calculateVatBreakdownForReceipt(order.orderItems, totalDiscount)

  // FIX CRITICAL: Atomna sekvenčna številka + ustvarjanje računa v transakciji (FURS skladnost)
  // P1-7 (FURS): številka računa je vezana na POSLOVNI PROSTOR (lokacija) in leto —
  // R-YYYY-NNNNNN se številči PO LOKACIJI (poslovno pravilo za FURS premises).
  // P1-6: Receipt.locationId izhaja iz order.locationId (nikoli iz bodyja).
  const receipt = await db.$transaction(async (tx) => {
    const receiptNumber = await getNextReceiptNumber(order.locationId, tx)

    // ZOI placeholder
    const zoi = generateZOIPlaceholder(order.orderNumber, receiptNumber)

    const created = await tx.receipt.create({
      data: {
        receiptNumber,
        orderId: id,
        // FIX P0-C3A: snapshot poslovnih podatkov iz PRAVE lokacije (ne globalnih settings)
        businessName: s2.name,
        businessAddress: `${s2.address}, ${s2.postCode} ${s2.city}`,
        businessId: s2.businessId,
        taxId: s2.taxId,
        registerId: s2.registerNumber,
        zoi,
        eor: '',
        fiscalVerified: false,
        subtotal: order.subtotal,
        vatBreakdown: JSON.stringify(vatBreakdownForReceipt),
        totalVat: order.tax,
        discount: order.discount,
        total: order.total,
        tip: toNum(order.tip),
        totalWithTip: round2(toNum(order.total) + toNum(order.tip)),
        paymentMethod: data.paymentMethod,
        isCopy: false,
        isStorno: data.isStorno,
        stornoOf: data.stornoOf,
        // P1-6: račun pripada lokaciji naročila (fiskalna veriga Order → Receipt)
        locationId: order.locationId,
      },
    })

    // FIX MEDIUM: Posodobi order paymentMethod če še ni nastavljen
    if (!order.paymentMethod && data.paymentMethod) {
      await tx.order.update({
        where: { id },
        data: { paymentMethod: data.paymentMethod },
      })
    }

    return created
  })

  // ── Runda 29 (CIS HR): AUTO-ODDAJA na FINA ob plačilu ──
  // Fire-and-forget, NON-BLOCKING (POS pravilo: fiskalizacija ne blokira
  // prodaje — napaka gre v cisStatus='pending' za retry, odgovor klijentu
  // gre takoj). Skip logika živi v submitReceiptToCis: SI tenant brez P12 →
  // cisStatus ostane 'none' (brez sledi); storno/predračun → skip.
  void submitReceiptToCis(receipt.id).catch((err: unknown) => {
    logger.error(
      'CIS',
      `Auto-oddaja Receipt ${receipt.receiptNumber} napaka:`,
      err instanceof Error ? err.message : String(err)
    )
  })

  return NextResponse.json(validateApiResponse(deepToNumbers(receipt), receiptCreatedResponseSchema, 'POST /api/receipts/[id]'), { status: 201 })
}

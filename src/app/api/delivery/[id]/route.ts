
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { updateDeliverySchema } from '@/lib/validations'
import { decimalsToNumbers } from '@/lib/decimal'
import { handleRouteError, parseJsonBody, validateBody } from '@/lib/api-utils'
// FIX R112 (WEBHOOK-5, MED): enoten vir prehodov statusov dostave — ista mapa
// kot voznikova pot (POST /api/delivery-tracking). Prej je imela ta ruta lastno
// lokalno validTransitions mapo in NEPOGOJEN update (READ COMMITTED tx brez
// CAS) → 3 nepovezani writerji, last-writer-wins, regresija delivered →
// picked_up.
import {
  canTransitionDeliveryStatus,
  STALE_DELIVERY_STATUS_MESSAGE,
} from '@/app/api/delivery/_helpers/status-transitions'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za posodobitev dostave
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX HIGH: Zod validacija namesto direktnega branja body-ja — prepreči injection
    const { data, error: validationError } = validateBody(updateDeliverySchema, bodyResult.data)
    if (validationError) return validationError

    // FIX D-03 HIGH: Uporabi transakcijo za preprečitev race condition na status prehodih
    // FIX IDOR (tenant scope): dostava je rešena prek verige DeliveryInfo → Order → locationId
    // (natakar lokacije A ne more spreminjati dostav lokacije B; dostave brez
    // povezanega naročila (order=null) so dostopne samo super adminu z locationId=null)
    // R86-2b (M2 razred): prej raw spread `session?.locationId ?? undefined` —
    // fail-open za non-admin seja z NULL lokacijo (cross-tenant status/address
    // update dostave). Resolver: fail-closed 403 + conditional spread iz scope-a.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PUT /api/delivery/[id]',
    })
    if ('error' in scope) return scope.error

    // FIX R112 (WEBHOOK-5, MED — last-writer-wins razred iz R100–R111): prej je
    // bila preverba prehodov na zastarelem branju in update NEPOGOJEN — med
    // read in update je lahko drug writer (voznikova pot / dodelitev) zapisal
    // status → naš zapis ga je pregazil (delivered → picked_up regresija).
    // Sedaj: tx-fresh branje (ostaja v tx) + preverba prehoda prek SKUPNE mape
    // + CAS updateMany ({ where: { id, status: <freshStatus> } }) — count 0 →
    // 409 'Status dostave je v medčasom spremenjen — osvežite'.
    const delivery = await db.$transaction(async (tx) => {
      const existing = await tx.deliveryInfo.findFirst({
        where: { id, ...(scope.locationId ? { order: { locationId: scope.locationId } } : {}) },
      })
      if (!existing) {
        throw new Error('DELIVERY_NOT_FOUND')
      }

      // State machine za dostavne statuse (skupna mapa — WEBHOOK-5)
      if (data.status !== undefined && existing.status !== data.status) {
        if (!canTransitionDeliveryStatus(existing.status, data.status)) {
          // Isti { match, extra } error kontrakt kot prej (INVALID_TRANSITION)
          throw new Error(`INVALID_TRANSITION:${existing.status}:${data.status}`)
        }
      }

      const updateData: Record<string, unknown> = {}
      if (data.address !== undefined) updateData.address = data.address
      if (data.city !== undefined) updateData.city = data.city
      if (data.postCode !== undefined) updateData.postCode = data.postCode
      if (data.recipientName !== undefined) updateData.recipientName = data.recipientName
      if (data.recipientPhone !== undefined) updateData.recipientPhone = data.recipientPhone
      if (data.deliveryInstructions !== undefined) updateData.deliveryInstructions = data.deliveryInstructions
      if (data.promisedTime !== undefined) updateData.promisedTime = data.promisedTime ? new Date(data.promisedTime) : null
      if (data.estimatedTime !== undefined) updateData.estimatedTime = data.estimatedTime ? new Date(data.estimatedTime) : null
      if (data.actualTime !== undefined) updateData.actualTime = data.actualTime ? new Date(data.actualTime) : null
      if (data.courierName !== undefined) updateData.courierName = data.courierName
      if (data.courierPhone !== undefined) updateData.courierPhone = data.courierPhone
      if (data.status !== undefined) updateData.status = data.status
      if (data.packagingFee !== undefined) updateData.packagingFee = data.packagingFee
      if (data.deliveryFee !== undefined) updateData.deliveryFee = data.deliveryFee
      if (data.latitude !== undefined) updateData.latitude = data.latitude
      if (data.longitude !== undefined) updateData.longitude = data.longitude

      // CAS namesto nepogojenega update-a — stale concurrent write ne sme zmagati
      const cas = await tx.deliveryInfo.updateMany({
        where: { id, status: existing.status },
        data: updateData,
      })
      if (cas.count === 0) {
        throw new Error('STATUS_CONFLICT')
      }

      // Ponovno branje za odgovor (enaka oblika polj kot prejšnji update +
      // include order — kontrakt odgovora nespremenjen)
      const updated = await tx.deliveryInfo.findFirst({
        where: { id },
        include: { order: true },
      })
      if (!updated) {
        throw new Error('DELIVERY_NOT_FOUND')
      }
      return updated
    })

    return NextResponse.json(decimalsToNumbers(delivery, ['deliveryFee', 'packagingFee']))
  } catch (error: unknown) {
    return handleRouteError(error, 'PUT /api/delivery/[id]', [
      { match: 'DELIVERY_NOT_FOUND', message: 'Dostava ni najdena', status: 404 },
      { match: 'INVALID_TRANSITION', message: 'Neveljaven prehod statusa', status: 400, extra: (parts) => ({ error: `Neveljaven prehod statusa: ${parts[1]} → ${parts[2]}`, currentStatus: parts[1], requestedStatus: parts[2] }) },
      // FIX R112 (WEBHOOK-5): izgubljena CAS tekma → 409 (osvežitev stale pogleda)
      { match: 'STATUS_CONFLICT', message: STALE_DELIVERY_STATUS_MESSAGE, status: 409 },
    ], 'Napaka pri posodobitvi dostave')
  }
}

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { updateGiftCardSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'
import { toNum, greaterThan, deepToNumbers } from '@/lib/decimal'
import { canDeleteGiftCard } from '@/lib/gift-card-guard'
import { giftCardLast4 } from '@/lib/gift-cards/constants'
import { structuredErrorResponse } from '@/lib/structured-error'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX C-05: Zahtevaj avtentikacijo za spreminjanje kartice
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateGiftCardSchema, bodyResult.data)
    if (validationError) return validationError
    const existing = await db.giftCard.findUnique({ where: { id } })
    if (!existing) {
      // FIX R144-d (zero-oracle): hardcoded 'najdena' je bil 1-znakovni ID-enumeration
      // oracle proti notInScopeResponse('Darilna kartica') = 'Darilna kartica ni
      // najden' — tuja kartica ≡ neobstoječa zahteva IDENTIČNO telo (r142 kanon,
      // kontrakt R144-a). EN vir resnice: isti helper kot scope 404 spodaj.
      return notInScopeResponse('Darilna kartica')
    }
    // FIX R80 (HIGH, cross-tenant): parent findUnique je bil nescopecan —
    // take_orders staff je lahko bral/manipuliral STANJE kartice poljubne
    // lokacije (giftCardTransaction.count je dedoval nescopecan parent).
    // Scope iz seje; izven scope-a → 404 (ne razkrivamo obstoja kartice).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'PUT /api/gift-cards/[id]',
    })
    if ('error' in scope) return scope.error
    if (!isWithinScope(scope.locationId, existing.locationId)) {
      return notInScopeResponse('Darilna kartica')
    }
    // FIX MEDIUM: Preveri, da kartica ni potekla ali suspendirana — ne dovoli sprememb
    if (existing.status === 'suspended') {
      return NextResponse.json({ error: 'Suspendirane kartice ni mogoče spreminjati' }, { status: 400 })
    }
    if (existing.expiresAt && existing.expiresAt < new Date() && existing.status !== 'expired') {
      // Avtomatsko označi kot poteklo
      await db.giftCard.update({ where: { id }, data: { status: 'expired' } })
      return NextResponse.json({ error: 'Darilna kartica je potekla' }, { status: 400 })
    }
    // FIX H-05: Atomna transakcija za posodobitev stanja + transakcijski zapis
    const _result = await db.$transaction(async (tx) => {
      // FIX H-01: Ponovno preberi kartico ZNOTRAJ transakcije — prepreči TOCTOU
      const existing = await tx.giftCard.findUnique({ where: { id } })
      if (!existing) {
        throw { error: 'Darilna kartica ni najdena', status: 404 }
      }
      // FIX R103 (G2, MEDIUM): status re-validacija ZNOTRAJ tx — prej je bil
      // suspended/potekla check SAMO pred tx; sočasni suspend (ali potek)
      // med pre-checkom in tx je zamenjal stanje suspendirane/potečene kartice.
      if (existing.status === 'suspended') {
        throw { error: 'Suspendirane kartice ni mogoče spreminjati', status: 400 }
      }
      if (existing.expiresAt && existing.expiresAt < new Date() && existing.status !== 'expired') {
        throw { error: 'Darilna kartica je potekla', status: 400 }
      }

      const updateData: Record<string, unknown> = {}
      if (data.status !== undefined) updateData.status = data.status
      if (data.ownerName !== undefined) updateData.ownerName = data.ownerName
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null

      // R144-b: balanceBefore iz tx-svežega branja (forenzika — pariteta
      // balanceAfter iz post-op stanja).
      const balanceBefore = toNum(existing.balance)

      // Dejansko uporabljena sprememba stanja (za knjigovodski zapis)
      let appliedDelta: number | null = null

      // FIX CRITICAL: Atomna sprememba stanja — prepreči race condition
      if (data.balance !== undefined) {
        const diff = data.balance - toNum(existing.balance) // FIX: Decimal→number pretvorba
        if (diff > 0) {
          // Nalaganje — atomno povečaj
          // FIX R103 (G1, HIGH TOCTOU load-cap): prej je bil cap check
          // (`existing.balance + diff > maxBalance`) izveden proti STALE tx-
          // začetnem branju, increment pa NEPOGOJEN — dva sočasna naloga sta
          // oba presegla začetno vrednost (tiskanje denarja). Zdaj: pogojni
          // updateMany — DB vrednoti predikat proti TEKOČEMU stanju:
          // increment se zgodi samo če balance <= maxBalance - diff.
          const maxBalance = toNum(existing.initialBalance) > 0 ? toNum(existing.initialBalance) : toNum(existing.balance) // FIX: Decimal(0) je truthy!
          const loadResult = await tx.giftCard.updateMany({
            where: { id, balance: { lte: maxBalance - diff } },
            data: { balance: { increment: diff } },
          })
          if (loadResult.count === 0) {
            throw { error: 'Balance would exceed initial card value', status: 409 }
          }
          // FIX: Če se kartica ponovno naloži, spremeni status nazaj na active
          // (preberemo iz tx-začetnega stanja — classifier, ne ekonomija)
          if (existing.status === 'depleted') {
            updateData.status = 'active'
          }
          appliedDelta = diff
        } else if (diff < 0) {
          // Poraba/unovčitev — preveri, da stanje ne pade pod 0
          const absDiff = Math.abs(diff)
          const result = await tx.giftCard.updateMany({
            where: { id, balance: { gte: absDiff } },
            data: { balance: { decrement: absDiff } },
          })
          if (result.count === 0) {
            throw { error: 'Insufficient gift card balance', status: 400 }
          }
          // Preveri novo stanje za status
          const updated = await tx.giftCard.findUnique({ where: { id } })
          if (updated && !greaterThan(updated.balance, 0)) { // FIX: Decimal primerjava
            updateData.status = 'depleted'
          }
          appliedDelta = diff
        }
        // diff === 0: no balance change needed
      }

      // FIX R103 (G3, MEDIUM ledger forenzika): auto zapis transakcije je bil
      // izpeljan iz STALE compare-a (`data.balance !== toNum(existing.balance)`)
      // — ob sočasni mutaciji je zapisal NAPAČEN znesek/smer. Zdaj: zapis iz
      // DEJANSKO uporabljene spremembe (appliedDelta) + balanceAfter iz
      // post-op stanja (isti vzorec kot payments handleGiftCardDeduction).
      const giftCard =
        Object.keys(updateData).length > 0
          ? await tx.giftCard.update({ where: { id }, data: updateData })
          : await tx.giftCard.findUnique({ where: { id } })

      // Ustvari transakcijski zapis, če je podan
      if (data.transaction) {
        const txData = data.transaction
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: id,
            type: txData.type,
            amount: txData.amount,
            balanceAfter: txData.balanceAfter ?? toNum(giftCard?.balance ?? 0),
            orderId: txData.orderId || null,
            checkId: txData.checkId || null,
            note: txData.note || '',
          },
        })
      } else if (appliedDelta !== null) {
        // Avtomatsko ustvari transakcijski zapis za spremembo stanja
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: id,
            type: appliedDelta > 0 ? 'load' : 'redeem',
            amount: appliedDelta,
            balanceAfter: giftCard?.balance ?? 0,
            note: appliedDelta > 0 ? 'Nalaganje sredstev' : 'Razveljavitev',
          },
        })
      }

      // R144-b: AUDIT V ISTEM tx (createAuditLog(entry, tx) kanon — feedback
      // ruta; hash veriga bere/piše v isti transakciji). DIFF-ONLY canon (R142
      // PATCH devices): samo DEJANSKE spremembe se auditrajo — no-op PUT
      // (appliedDelta null IN status nespremenjen) ne zapiše NIČESA.
      // PII kanon: NIKOLI poln cardNumber v details — samo last4.
      const balanceAfter = toNum(giftCard?.balance ?? 0)
      if (appliedDelta !== null) {
        await createAuditLog({
          userId: authResult.session?.employeeId,
          action: 'GIFT_CARD_ADJUSTED',
          entityType: 'GiftCard',
          entityId: id,
          details: {
            delta: appliedDelta,
            balanceBefore,
            balanceAfter,
            cardLast4: giftCardLast4(existing.cardNumber),
          },
          locationId: existing.locationId,
        }, tx)
      }
      const statusAfter = giftCard?.status ?? existing.status
      if (statusAfter !== existing.status) {
        // Vključno z depleted→active reaktivacijo ob load-u (klasifikator,
        // ne ekonomija) in eksplicitnim data.status prehodom.
        await createAuditLog({
          userId: authResult.session?.employeeId,
          action: 'GIFT_CARD_STATUS_CHANGED',
          entityType: 'GiftCard',
          entityId: id,
          details: {
            before: existing.status,
            after: statusAfter,
            cardLast4: giftCardLast4(existing.cardNumber),
          },
          locationId: existing.locationId,
        }, tx)
      }

      return giftCard
    })
    // Re-fetch z transakcijami
    const giftCard = await db.giftCard.findUnique({
      where: { id },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    })
    return NextResponse.json(deepToNumbers(giftCard))
  } catch (error: unknown) {
    // FIX R103 (G8, error kontrakt): strukturirani throw-i iz tx telesa
    // (404 mid-flight izbris, 400 suspendirana/potekla/nimajo sredstev,
    // 409 cap) so PREJ padli v handleApiError → 500 '[object Object]'.
    return structuredErrorResponse(error, 'PUT /api/gift-cards/[id]', 'Napaka pri posodobitvi darilne kartice')
  }
}

// ============================================
// RUNDA 69: DELETE /api/gift-cards/[id] — brisanje darilne kartice
// Zaščita (gift-card-guard, ENOTEN VIR z UI dialogom): kartica z
// transakcijami (fiskalna zgodovina, FK Restrict) ali stanjem > 0 je
// BLOKIRANA (409) s predlogom suspendiranja; prazna kartica se izbriše.
// Prej: endpoint sploh ni obstajal → UI delete gumb = vedno 405.
// ============================================
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Brisanje denarne entitete je admin akcija (ostržnejša od PUT take_orders)
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    const { id } = await params
    const existing = await db.giftCard.findUnique({ where: { id } })
    if (!existing) {
      // FIX R144-d (zero-oracle): isti 1-znakovni oracle kot v PUT zgoraj —
      // pre-check 404 MORA biti telo-identičen notInScopeResponse('Darilna kartica').
      return notInScopeResponse('Darilna kartica')
    }
    // FIX R80 (HIGH, cross-tenant): isti scope check kot PUT — admin brez
    // lokacijske pripadnosti ne sme brisati kartic tujih tenantov (count
    // transakcij zraven deduje samo po uspešnem scope checku).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'DELETE /api/gift-cards/[id]',
    })
    if ('error' in scope) return scope.error
    if (!isWithinScope(scope.locationId, existing.locationId)) {
      return notInScopeResponse('Darilna kartica')
    }
    const [txnCount, fresh] = await Promise.all([
      db.giftCardTransaction.count({ where: { giftCardId: id } }),
      db.giftCard.findUnique({ where: { id }, select: { balance: true } }),
    ])
    const decision = canDeleteGiftCard(txnCount, toNum(fresh?.balance ?? existing.balance))
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.messageSl }, { status: decision.status })
    }
    // FIX R103 (G5): prej db.giftCard.delete({ where: { id } }) — mid-flight
    // izbris (dvojni DELETE) → P2025 → 500. Scoped deleteMany → count 0 →
    // 404 (R102 F5 vzorec); FK Restrict (P2003) ob mid-flight transakciji →
    // 409 v catch (fiskalna zgodovina se nikoli ne izbriše tiho).
    const deleted = await db.giftCard.deleteMany({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Darilna kartica ni najdena' }, { status: 404 })
    }
    // R144-b: audit GIFT_CARD_DELETED — SAMO po uspešnem izbrisu (audit
    // obstaja ⇔ prehod obstaja). IZBIRA (dokumentirana): deleteMany ostane
    // db-level klic (R103 G5 kanon), audit teče prek createAuditLog lastne
    // transakcije (fail-safe — nikoli ne podre requesta); pariteta in-tx
    // (deleteMany v $transaction) bi zahtevala tx-level deleteMany, kar bi
    // lomilo obstoječe trap-DB mocke (r80-b2/r103) brez funkcionalne koristi.
    // PII kanon: samo last4 — poln cardNumber nikoli v details.
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'GIFT_CARD_DELETED',
      entityType: 'GiftCard',
      entityId: id,
      details: {
        cardLast4: giftCardLast4(existing.cardNumber),
        balanceAtDelete: toNum(fresh?.balance ?? existing.balance),
        txnCount,
      },
      locationId: existing.locationId,
    })
    return NextResponse.json({ ok: true, id })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2003'
    ) {
      return NextResponse.json(
        { error: 'Kartica ima transakcijsko zgodovino — brisanje ni mogoče (uporabite suspendiranje)' },
        { status: 409 },
      )
    }
    return handleApiError(error, 'DELETE /api/gift-cards/[id]', 'Napaka pri brisanju darilne kartice')
  }
}

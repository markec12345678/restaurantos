import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { updateLoyaltySchema } from '@/lib/validations'
import { handleRouteError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { canDeleteLoyaltyAccount } from '@/lib/loyalty-guard'
import { maybeTierUpgrade, tierLabelSi } from '@/lib/loyalty-tiers'
import { triggerTierUpgrade } from '@/lib/loyalty-automation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    // FIX R86-5 (HIGH, M2 razred): raw `session?.locationId ?? undefined` je bil
    // fail-OPEN za regular uporabnika brez lokacije (prazen filter = globalni
    // findFirst → cross-tenant branje/pisanje točk, tier + SMS). Canonical
    // resolver: regular-null → 403, super-admin (null) = globalni pogled.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'PUT /api/loyalty/[id]',
    })
    if ('error' in scope) return scope.error
    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateLoyaltySchema, bodyResult.data)
    if (validationError) return validationError
    // FIX IDOR (tenant scope): findUnique → findFirst z locationId scope (cross-tenant zaščita)
    const existing = await db.loyaltyAccount.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Zvestobni račun ni najden' }, { status: 404 })
    }
    // FIX H-05: Atomna transakcija za posodobitev točk + transakcijski zapis
    const { result: _result, tierUpgrade } = await db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {}
      if (data.customerName !== undefined) updateData.customerName = data.customerName
      if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone
      if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail
      if (data.tier !== undefined) updateData.tier = data.tier
      if (data.isActive !== undefined) updateData.isActive = data.isActive
      if (data.pointsBalance !== undefined) {
        const newPoints = Math.max(0, data.pointsBalance)
        // FIX MEDIUM: Zgornja meja za ročno prilaganje točk — prepreči zlorabo
        const MAX_POINTS_PER_ADJUSTMENT = 50000
        const MAX_TOTAL_POINTS = 500000
        const diff = newPoints - existing.pointsBalance
        if (diff > MAX_POINTS_PER_ADJUSTMENT) {
          throw new Error(`Enkratno prilaganje omejeno na ${MAX_POINTS_PER_ADJUSTMENT} točk. Za večje prilagoditve kontaktirajte administratorja.`)
        }
        if (newPoints > MAX_TOTAL_POINTS) {
          throw new Error(`Skupno število točk ne more preseči ${MAX_TOTAL_POINTS}.`)
        }
        if (diff > 0) {
          // FIX HIGH: Atomic increment za pridobivanje točk — prepreči race condition
          updateData.pointsBalance = { increment: diff }
          // Posodobi tudi lifetimePoints — atomsko
          // FIX BUG: Ne prepiši lifetimePoints, če je tudi data.lifetimePoints podan
          if (data.lifetimePoints === undefined) {
            updateData.lifetimePoints = { increment: diff }
          }
        } else if (diff < 0) {
          // FIX HIGH: Prepreči, da pointsBalance pade pod 0 (race condition)
          // Uporabi updateMany s pogojem namesto plain decrement
          const absDiff = Math.abs(diff)
          const updated = await tx.loyaltyAccount.updateMany({
            where: { id, pointsBalance: { gte: absDiff } },
            data: { pointsBalance: { decrement: absDiff } },
          })
          if (updated.count === 0) {
            throw new Error('Ni dovolj točk za unovčenje')
          }
          // Ne nastavi updateData.pointsBalance — že posodobljeno atomsko
          // lifetimePoints se ne zmanjša ob unovčenju
        }
        // diff === 0: ni spremembe, ne nastavljaj
      }
      // FIX BUG: lifetimePoints naj se nastavi SAMO če ni že nastavljen preko pointsBalance logike
      if (data.lifetimePoints !== undefined && !updateData.lifetimePoints) {
        updateData.lifetimePoints = Math.max(0, data.lifetimePoints)
      }
      const account = await tx.loyaltyAccount.update({
        where: { id },
        data: updateData,
      })

      // RUNDA 61: ZAKLJUČITEV NIVO TOKA — ročni adjust NE SME ostati
      // brez povišanja. Prej je lifetime sprememba (adjust/ročni vnos) pustila
      // tier star → "stuck" računi (živi dokaz v produkciji: lifetime 543,
      // tier bronze). Enak upgrade-only vzorec kot earn flow (Runda 44):
      // ročno dodeljen VIŠJI nivo se nikoli ne poniži.
      let tierUpgrade: { from: string; to: string } | null = null
      const upgradedTo = maybeTierUpgrade(existing.tier, account.lifetimePoints)
      if (upgradedTo) {
        await tx.loyaltyAccount.update({
          where: { id },
          data: { tier: upgradedTo },
        })
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: id,
            type: 'earn',
            points: 0,
            reason: `Povišanje nivoa v ${tierLabelSi(upgradedTo)}`,
          },
        })
        tierUpgrade = { from: existing.tier, to: upgradedTo }
        logger.info('LOYALTY', 'Rocni adjust sprozil povicanje nivoa', {
          loyaltyAccountId: id,
          from: existing.tier,
          to: upgradedTo,
        })
      }

      // Ustvari transakcijski zapis, če je podan
      if (data.transaction) {
        const txData = data.transaction
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: id,
            type: txData.type,
            points: txData.points,
            reason: txData.reason || '',
            orderId: txData.orderId || null,
            checkId: txData.checkId || null,
            monetaryValue: txData.monetaryValue ?? 0,
          },
        })
      } else if (data.pointsBalance !== undefined && data.pointsBalance !== existing.pointsBalance) {
        // Avtomatsko ustvari transakcijski zapis za spremembo točk
        const diff = data.pointsBalance - existing.pointsBalance
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: id,
            type: diff > 0 ? 'earn' : 'redeem',
            points: diff,
            reason: diff > 0 ? 'Prislužene točke' : 'Unovčenje točk',
          },
        })
      }
      return { result: account, tierUpgrade }
    })

    // RUNDA 61: SMS o napredovanju — šele PO commitu (nikoli znotraj
    // transakcije: HTTP klic ne sme blokirati/zapreti DB transakcije) in
    // fire-and-forget: spodleteli SMS NIKOLI ne pokvari uspešnega adjusta.
    if (tierUpgrade) {
      void triggerTierUpgrade(id, tierUpgrade.from, tierUpgrade.to).catch((err: unknown) => {
        logger.warn('LOYALTY', `Nivo-upgrade SMS spodletel (ne kritično): ${err instanceof Error ? err.message : String(err)}`)
      })
    }

    // Re-fetch z transakcijami (FIX IDOR: tudi tukaj locationId scope)
    const account = await db.loyaltyAccount.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    })
    if (!account) {
      return NextResponse.json({ error: 'Zvestobni račun ni najden' }, { status: 404 })
    }
    // RUNDA 61: klient dobi flag za celebrate toast ("stranka napredovala!")
    const response = deepToNumbers(account) as Record<string, unknown>
    if (tierUpgrade) response.tierUpgrade = tierUpgrade
    return NextResponse.json(response)
  } catch (error: unknown) {
    return handleRouteError(error, 'PUT /api/loyalty/[id]', [
      { match: 'omejeno na', substring: true, status: 400, message: error instanceof Error ? error.message : 'Omejitev presežena' },
      { match: 'ne more preseči', substring: true, status: 400, message: error instanceof Error ? error.message : 'Omejitev presežena' },
      { match: 'Ni dovolj točk', substring: true, status: 400, message: error instanceof Error ? error.message : 'Ni dovolj točk' },
    ], 'Napaka pri posodobitvi zvestobnega računa')
  }
}

// ============================================
// RUNDA 69: DELETE /api/loyalty/[id] — brisanje zvestobnega računa
// Zaščita (loyalty-guard, ENOTEN VIR z UI dialogom): račun z transakcijami
// (zgodovina točk, FK Restrict) ali točkami > 0 je BLOKIRAN (409) s predlogom
// deaktivacije (isActive=false prek PUT); prazen račun se izbriše.
// Prej: endpoint ni obstajal → UI delete gumb = vedno 405, dialog pa je
// LAŽNO trdil, da "bodo transakcije izbrisane".
// ============================================
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Brisanje računa z zgodovino točk je admin akcija
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    // FIX R86-5 (HIGH, M2 razred): raw `?? undefined` fail-open za regular-null
    // seja → cross-tenant DELETE. Canonical resolver (isti vzorec kot PUT).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'DELETE /api/loyalty/[id]',
    })
    if ('error' in scope) return scope.error
    const { id } = await params
    // IDOR zaščita: isti scope vzorec kot PUT zgoraj (session location)
    const existing = await db.loyaltyAccount.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Zvestobni račun ni najden' }, { status: 404 })
    }
    const txnCount = await db.loyaltyTransaction.count({ where: { loyaltyAccountId: id } })
    const decision = canDeleteLoyaltyAccount(txnCount, existing.pointsBalance)
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.messageSl }, { status: decision.status })
    }
    await db.loyaltyAccount.delete({ where: { id } })
    return NextResponse.json({ ok: true, id })
  } catch (error: unknown) {
    return handleRouteError(error, 'DELETE /api/loyalty/[id]', [], 'Napaka pri brisanju zvestobnega računa')
  }
}

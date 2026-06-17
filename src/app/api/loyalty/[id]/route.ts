import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateLoyaltySchema } from '@/lib/validations'
import { handleRouteError, parseJsonBody, validateBody } from '@/lib/api-utils'

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
    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateLoyaltySchema, bodyResult.data)
    if (validationError) return validationError
    const existing = await db.loyaltyAccount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Zvestobni račun ni najden' }, { status: 404 })
    }
    // FIX H-05: Atomna transakcija za posodobitev točk + transakcijski zapis
    const _result = await db.$transaction(async (tx) => {
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
      return account
    })
    // Re-fetch z transakcijami
    const account = await db.loyaltyAccount.findUnique({
      where: { id },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    })
    return NextResponse.json(deepToNumbers(account))
  } catch (error: unknown) {
    return handleRouteError(error, 'PUT /api/loyalty/[id]', [
      { match: 'omejeno na', substring: true, status: 400, message: error instanceof Error ? error.message : 'Omejitev presežena' },
      { match: 'ne more preseči', substring: true, status: 400, message: error instanceof Error ? error.message : 'Omejitev presežena' },
      { match: 'Ni dovolj točk', substring: true, status: 400, message: error instanceof Error ? error.message : 'Ni dovolj točk' },
    ], 'Napaka pri posodobitvi zvestobnega računa')
  }
}

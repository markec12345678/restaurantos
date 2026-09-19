// ============================================
// RUNDA 69: /api/happy-hour/[id] — PATCH (toggle aktivnosti) + DELETE
// Prej: route sploh ni obstajal → toggle in izbris v HappyHourTab sta bila
// TICHA LAŽNA USPEHA (Next je vrnil 200 + HTML not-found stran; client je
// videl res.ok → toast "Izbrisano", ampak se NIČ ni izbrisalo). Poleg tega
// UI delete ni imel potrditvenega dialoga (nevaren instant delete).
// HappyHourSchedule je leaf model (vhodne FK: ne obstajajo; priceGroup je
// STARŠ z Cascade) → hard delete je varen po obstoječem checku.
// ============================================
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { happyHourStatusSchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// PATCH /api/happy-hour/[id] — preklop isActive (toggle stikalo v UI)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const { data, error: validationError } = validateBody(happyHourStatusSchema, bodyResult.data)
    if (validationError) return validationError
    const existing = await db.happyHourSchedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Happy Hour urnik ni najden' }, { status: 404 })
    }
    const updated = await db.happyHourSchedule.update({
      where: { id },
      data: { isActive: data.isActive },
      include: { priceGroup: true },
    })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/happy-hour/[id]', 'Napaka pri preklopu Happy Hour urnika')
  }
}

// DELETE /api/happy-hour/[id] — izbris urnika (leaf → varen hard delete)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    const { id } = await params
    const existing = await db.happyHourSchedule.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Happy Hour urnik ni najden' }, { status: 404 })
    }
    await db.happyHourSchedule.delete({ where: { id } })
    return NextResponse.json({ ok: true, id })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/happy-hour/[id]', 'Napaka pri brisanju Happy Hour urnika')
  }
}

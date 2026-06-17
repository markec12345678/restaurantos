import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { decimalsToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// FIX HIGH: Zod validacija za posodobitev popusta
const updateDiscountSchema = z.object({
  name: z.string().min(1, 'Ime popusta je obvezno').max(200, 'Ime ne sme preseči 200 znakov').optional(),
  type: z.enum(['percentage', 'fixed_amount', 'buy_x_get_y'], { message: 'Neveljaven tip popusta' }).optional(),
  amount: z.number().positive('Znesek mora biti pozitiven').max(100000, 'Znesek ne sme preseči 100.000').optional(),
  appliesTo: z.enum(['check', 'item', 'category'], { message: 'Neveljaven tarifni razred' }).optional(),
  triggerType: z.enum(['manual', 'auto', 'promo_code'], { message: 'Neveljaven tip prožilca' }).optional(),
  promoCode: z.string().max(100, 'Promo koda ne sme preseči 100 znakov').optional(),
  maxUses: z.number().int().positive('Največje število uporab mora biti pozitivno').max(1000000, 'Največje število uporab ne sme preseči 1.000.000').nullable().optional(),
  validFrom: z.string().max(50, 'Datum od ne sme preseči 50 znakov').nullable().optional(),
  validTo: z.string().max(50, 'Datum do ne sme preseči 50 znakov').nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0, 'Vrstni red mora biti 0 ali več').max(999, 'Vrstni red ne sme preseči 999').optional(),
}).refine(d => {
  // Percentage discount ne sme preseči 100%
  if (d.type === 'percentage' && d.amount !== undefined && d.amount > 100) return false
  return true
}, { message: 'Odstotni popust ne sme preseči 100%', path: ['amount'] })

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za posodobitev popusta
    const authResult = await requireAuth(req, { permission: 'apply_discounts' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const { data, error: validationError } = await validateRequest(req, updateDiscountSchema)
    if (validationError) return validationError

    // FIX C-06: currentUses ni mogoče nastaviti neposredno
    // (validateRequest already strips unknown fields, but double-check)

    // FIX HIGH: Preveri, da popust obstaja
    const existing = await db.discount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Popust ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.type !== undefined) updateData.type = data.type
    if (data.amount !== undefined) updateData.amount = data.amount
    if (data.appliesTo !== undefined) updateData.appliesTo = data.appliesTo
    if (data.triggerType !== undefined) updateData.triggerType = data.triggerType
    if (data.promoCode !== undefined) updateData.promoCode = data.promoCode
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses
    if (data.validFrom !== undefined) updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null
    if (data.validTo !== undefined) updateData.validTo = data.validTo ? new Date(data.validTo) : null
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

    const discount = await db.discount.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(decimalsToNumbers(discount, ['amount']))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/discounts/[id]', 'Napaka pri posodobitvi popusta')
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX C-05: Zahtevaj admin avtentikacijo za brisanje popusta
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // FIX HIGH: Preveri, da popust obstaja
    const existing = await db.discount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Popust ni najden' }, { status: 404 })
    }

    // FIX C-06: Soft delete namesto hard delete
    await db.discount.update({ where: { id }, data: { isActive: false } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/discounts/[id]', 'Napaka pri brisanju popusta')
  }
}

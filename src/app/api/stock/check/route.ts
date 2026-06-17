import { checkStockAvailability } from '@/lib/stock-deduction'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// ============================================
// POST /api/stock/check — Preveri razpoložljivost zaloge
// Uporabi se PRED oddajo naročila za opozorilo natakarja
// ============================================

const stockCheckSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().min(1, 'ID artikla je obvezen').max(100, 'ID artikla je predolg'),
    quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(999, 'Količina je prevelika'),
  })).min(1, 'Vsaj en artikel je obvezen').max(100, 'Največ 100 artiklov na preverbo'),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, stockCheckSchema)
    if (validationError) return validationError

    const result = await checkStockAvailability(data.items)

    return NextResponse.json({
      available: result.available,
      warnings: result.warnings,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/stock/check', 'Napaka pri preverjanju zaloge')
  }
}

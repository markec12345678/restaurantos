import { checkStockAvailability } from '@/lib/stock-deduction'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// ============================================
// POST /api/stock/check — Preveri razpoložljivost zaloge
// Uporabi se PRED oddajo naročila za opozorilo natakarja
// ============================================

const stockCheckSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().min(1),
  })).min(1),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const parsed = stockCheckSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: parsed.error.issues }, { status: 400 })
    }

    const result = await checkStockAvailability(parsed.data.items)

    return NextResponse.json({
      available: result.available,
      warnings: result.warnings,
    })
  } catch (error) {
    console.error('Stock check error:', error)
    return NextResponse.json({ error: 'Napaka pri preverjanju zaloge' }, { status: 500 })
  }
}

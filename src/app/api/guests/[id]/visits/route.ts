// POST /api/guests/[id]/visits — Zabeleži obisk gosta z hash chain
//
// FIX issue #35: GuestVisit hash chain je bil prej deklariran v schemi
// (previousHash + chainHash stolpca) a koda ju nikoli ni nastavila.
// Sedaj uporablja createGuestVisitWithChain() za transakcijsko varno
// pisanje z SHA-256 hash verigo (EU 852/2004 skladnost).
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { createGuestVisitWithChain } from '@/lib/guest-visit-chain'
import { db } from '@/lib/db'
import { z } from 'zod'

const createVisitSchema = z.object({
  orderId: z.string().nullable().optional(),
  tableId: z.string().nullable().optional(),
  partySize: z.number().int().min(1).max(50).default(1),
  totalSpent: z.number().min(0).default(0),
  tipAmount: z.number().min(0).default(0),
  feedbackScore: z.number().int().min(1).max(5).nullable().optional(),
  feedbackComment: z.string().max(1000).default(''),
  departedAt: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(0).default(0),
})

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id: guestId } = await params

    // Preveri, da gost obstaja
    const guest = await db.guest.findUnique({ where: { id: guestId } })
    if (!guest) {
      return NextResponse.json({ error: 'Gost ni najden' }, { status: 404 })
    }

    const { data, error: validationError } = await validateRequest(req, createVisitSchema)
    if (validationError) return validationError

    const visit = await createGuestVisitWithChain({
      guestId,
      orderId: data.orderId,
      tableId: data.tableId,
      partySize: data.partySize,
      totalSpent: data.totalSpent,
      tipAmount: data.tipAmount,
      feedbackScore: data.feedbackScore,
      feedbackComment: data.feedbackComment,
      employeeId: authResult.session?.employeeId || null,
      employeeName: authResult.session?.employeeId || '',
      departedAt: data.departedAt ? new Date(data.departedAt) : null,
      durationMinutes: data.durationMinutes,
    })

    return NextResponse.json(visit, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/guests/[id]/visits', 'Napaka pri zabeleženju obiska')
  }
}

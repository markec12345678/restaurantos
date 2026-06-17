
// =====================================================================
// OPENING HOURS [ID] — Posodobi/izbriši posamezen dan
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { z } from 'zod'


// Zod validacija za posodobitev delovnega časa
const updateOpeningHoursSchema = z.object({
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  breakStart: z.string().nullable().optional(),
  breakEnd: z.string().nullable().optional(),
  isClosed: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(updateOpeningHoursSchema, bodyResult.data)
    if (validationError) return validationError

    const hours = await db.openingHours.update({
      where: { id },
      data: {
        ...(data.openTime !== undefined && { openTime: data.openTime }),
        ...(data.closeTime !== undefined && { closeTime: data.closeTime }),
        ...(data.breakStart !== undefined && { breakStart: data.breakStart ?? '' }),
        ...(data.breakEnd !== undefined && { breakEnd: data.breakEnd ?? '' }),
        ...(data.isClosed !== undefined && { isClosed: data.isClosed }),
      },
    })

    return NextResponse.json(deepToNumbers(hours))
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/opening-hours/[id]', 'Napaka pri posodabljanju')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    await db.openingHours.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/opening-hours/[id]', 'Napaka pri brisanju')
  }
}

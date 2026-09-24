// ============================================
// BATCH PREPARATION DETAIL — GET / PATCH /api/batch-preparations/[id]
// ============================================
// GET   — polna podrobnost (glava + vrstice + izdelek), fail-closed scope
// PATCH — urejanje osnutka (samo DRAFT): opomba, izdelek/količina, vrstice
// Scope pariteta z stocktakes/[id] (R121): locationScope = session.locationId.
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { structuredErrorResponse } from '@/lib/structured-error'
import { z } from 'zod'
import { updateBatchPreparationDraft } from '../_helpers/batch-preparation-mutations'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  note: z.string().max(1000, 'Opomba je predolga').optional(),
  outputItemId: z
    .string()
    .min(5)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, 'Neveljaven ID izhodnega artikla')
    .optional(),
  outputQuantity: z
    .number()
    .positive('Proizvedena količina mora biti večja od 0')
    .max(1_000_000, 'Količina je prevelika')
    .optional(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z
          .string()
          .min(5)
          .max(100)
          .regex(/^[A-Za-z0-9_-]+$/, 'Neveljaven ID sestavine'),
        quantity: z
          .number()
          .positive('Količina sestavine mora biti večja od 0')
          .max(1_000_000, 'Količina je prevelika'),
      }),
    )
    .min(1, 'Priprava potrebuje vsaj eno sestavino')
    .max(50)
    .optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const locationScope = authResult.session?.locationId ?? null

    const preparation = await db.batchPreparation.findFirst({
      where: {
        id,
        ...(locationScope ? { locationId: locationScope } : {}),
      },
      include: {
        lines: true,
        outputItem: { select: { name: true, unit: true } },
      },
    })
    if (!preparation) {
      return NextResponse.json({ error: 'Priprava ni najdena' }, { status: 404 })
    }

    return NextResponse.json({ preparation: deepToNumbers(preparation) })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/batch-preparations/[id]', 'Napaka pri pridobivanju priprave')
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const locationScope = authResult.session?.locationId ?? null

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(patchSchema, bodyResult.data)
    if (validationError) return validationError

    const updated = await updateBatchPreparationDraft({
      preparationId: id,
      locationScope,
      note: data.note,
      outputItemId: data.outputItemId,
      outputQuantity: data.outputQuantity,
      lines: data.lines,
    })

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'BATCHPREP_UPDATE',
      entityType: 'BatchPreparation',
      entityId: id,
      details: {
        note: data.note !== undefined,
        outputChanged: data.outputItemId !== undefined || data.outputQuantity !== undefined,
        linesChanged: data.lines !== undefined,
      },
      locationId: (updated as { locationId?: string }).locationId ?? null,
    })

    return NextResponse.json({ preparation: deepToNumbers(updated) })
  } catch (error: unknown) {
    return structuredErrorResponse(error, 'PATCH /api/batch-preparations/[id]', 'Napaka pri urejanju priprave')
  }
}

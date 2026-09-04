// ============================================
// POST /api/sync/[id]/resolve — reši konflikt
// ============================================
// Admin izbere katere podatke obdržati (incoming/existing/merged).
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const resolveSchema = z.object({
  resolution: z.enum(['keep_incoming', 'keep_existing', 'merge', 'discard']),
  mergedData: z.any().optional(),
  notes: z.string().max(500).default(''),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const input = resolveSchema.parse(body)

    const existing = await db.syncState.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Sync state ni najden' }, { status: 404 })
    }

    if (existing.conflictStatus !== 'detected') {
      return NextResponse.json({ error: 'Ni konflikta za rešiti' }, { status: 400 })
    }

    // Pripravi resolved data glede na resolucijo
    let resolvedData: unknown = existing.conflictData
    const conflictData = (existing.conflictData as Record<string, unknown> | null) || {}

    if (input.resolution === 'keep_incoming') {
      resolvedData = conflictData.incomingData
    } else if (input.resolution === 'keep_existing') {
      resolvedData = conflictData.existingData
    } else if (input.resolution === 'merge' && input.mergedData) {
      resolvedData = input.mergedData
    } else if (input.resolution === 'discard') {
      resolvedData = null
    }

    // Posodobi sync state
    const updated = await db.syncState.update({
      where: { id },
      data: {
        conflictStatus: 'resolved',
        conflictData: {
          ...conflictData,
          resolution: input.resolution,
          resolvedData,
          resolvedAt: new Date().toISOString(),
          resolvedBy: 'admin',
          notes: input.notes,
        } as never,
        lastSyncedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, syncState: updated })
  } catch (err) {
    return handleApiError(err, 'sync resolve')
  }
}

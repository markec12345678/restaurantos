// ============================================
// /api/sync — Sync State + Conflict Resolution
// ============================================
// Multi-device sinhronizacija. Ko dve POS napravi hkrati
// spremenita isto entiteto, se zazna konflikt.
//
// Strategija reševanja:
//   1. Last-write-wins (default za non-financial)
//   2. Manual resolve (admin izbere pravilno verzijo)
//   3. Merge (kombinacija obeh)
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET — seznam sync stateov s konflikti ali filter
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('conflictStatus') // none, detected, resolved
    const entityType = searchParams.get('entityType')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    const where: Record<string, unknown> = {}
    if (status) where.conflictStatus = status
    if (entityType) where.entityType = entityType

    const [syncStates, stats] = await Promise.all([
      db.syncState.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      db.syncState.groupBy({
        by: ['conflictStatus'],
        _count: { conflictStatus: true },
      }),
    ])

    const statsObj = stats.reduce<Record<string, number>>((acc, s) => {
      acc[s.conflictStatus] = s._count.conflictStatus
      return acc
    }, {})

    return NextResponse.json({
      syncStates,
      count: syncStates.length,
      stats: {
        none: statsObj.none || 0,
        detected: statsObj.detected || 0,
        resolved: statsObj.resolved || 0,
        total: (statsObj.none || 0) + (statsObj.detected || 0) + (statsObj.resolved || 0),
      },
    })
  } catch (err) {
    return handleApiError(err, 'sync GET')
  }
}

// POST — zaznaj konflikt in kreiraj/posodobi sync state
const upsertSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().min(1).max(100),
  syncVersion: z.number().int().min(0),
  conflictStatus: z.enum(['none', 'detected', 'resolved']).default('none'),
  conflictData: z.any().optional(),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const input = upsertSchema.parse(body)

    // Preveri ali že obstaja
    const existing = await db.syncState.findUnique({
      where: {
        entityType_entityId: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
    })

    // Conflict detection: če incoming syncVersion < existing, je konflikt
    let conflictStatus = input.conflictStatus
    let conflictData = input.conflictData

    if (existing && existing.syncVersion > input.syncVersion) {
      // Stale write — zaznaj konflikt
      conflictStatus = 'detected'
      conflictData = {
        incomingVersion: input.syncVersion,
        existingVersion: existing.syncVersion,
        incomingData: input.conflictData,
        existingData: existing.conflictData,
        detectedAt: new Date().toISOString(),
      }
    }

    const syncState = await db.syncState.upsert({
      where: {
        entityType_entityId: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      create: {
        entityType: input.entityType,
        entityId: input.entityId,
        syncVersion: input.syncVersion,
        conflictStatus,
        conflictData: conflictData as never,
        lastSyncedAt: new Date(),
      },
      update: {
        syncVersion: Math.max(existing?.syncVersion || 0, input.syncVersion),
        conflictStatus,
        conflictData: conflictData as never,
        lastSyncedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, syncState })
  } catch (err) {
    return handleApiError(err, 'sync POST')
  }
}

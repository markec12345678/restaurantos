import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const logs = await db.auditLog.findMany({
      orderBy: { timestamp: 'asc' },
      take: 1000,
      select: { id: true, chainHash: true, previousHash: true, action: true, entityType: true, entityId: true, userId: true, details: true, timestamp: true },
    })

    let verified = 0
    let broken = 0
    const brokenEntries: Array<{ id: string; expected: string; actual: string }> = []
    let expectedPrev = ''

    for (const log of logs) {
      if (log.previousHash !== expectedPrev) {
        broken++
        brokenEntries.push({ id: log.id, expected: expectedPrev, actual: log.previousHash || '' })
      } else {
        const detailsStr = log.details || '{}'
        const hashPayload = [
          log.previousHash, log.action, log.entityType,
          log.entityId || '', log.userId || '', detailsStr,
        ].join('|')
        const expectedHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

        if (log.chainHash === expectedHash) {
          verified++
        } else {
          broken++
          brokenEntries.push({ id: log.id, expected: expectedHash, actual: log.chainHash || '' })
        }
      }
      expectedPrev = log.chainHash || ''
    }

    return NextResponse.json({
      total: logs.length,
      verified,
      broken,
      chainIntact: broken === 0,
      ...(brokenEntries.length > 0 ? { brokenEntries: brokenEntries.slice(0, 10) } : {}),
    })
  } catch {
    return NextResponse.json({ error: 'Napaka pri preverjanju verige' }, { status: 500 })
  }
}

// ============================================
// /api/security-audit — API Key management + Security audit
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
  rotateApiKey,
} from '@/lib/api-security'

export const dynamic = 'force-dynamic'

// GET — seznam vseh API ključev (brez hash)
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const keys = await listApiKeys()

    // Dodaj security audit info
    const audit = {
      totalKeys: keys.length,
      activeKeys: keys.filter((k) => k.isActive).length,
      expiredKeys: keys.filter((k) => k.expiresAt && new Date() > k.expiresAt).length,
      lastUsedToday: keys.filter((k) =>
        k.lastUsedAt && new Date() > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
    }

    return NextResponse.json({ keys, audit })
  } catch (err) {
    return handleApiError(err, 'security-audit GET')
  }
}

// POST — kreiraj nov API key
const createSchema = z.object({
  action: z.enum(['create', 'revoke', 'delete', 'rotate']),
  // Za create
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional(),
  // Za revoke/delete/rotate
  keyId: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const input = createSchema.parse(body)

    if (input.action === 'create') {
      if (!input.name || !input.scopes) {
        return NextResponse.json({ error: 'name in scopes sta obvezna za create' }, { status: 400 })
      }
      const result = await createApiKey({
        name: input.name,
        scopes: input.scopes,
        rateLimit: input.rateLimit,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdBy: 'admin',
      })
      // Vrni plain key samo enkrat
      return NextResponse.json({
        success: true,
        key: {
          id: result.id,
          name: result.name,
          keyPrefix: result.keyPrefix,
          scopes: result.scopes,
          rateLimit: result.rateLimit,
          expiresAt: result.expiresAt,
          createdAt: result.createdAt,
        },
        plainKey: result.plainKey, // SHRANI ZASEBNO — ne bo več prikazan
        warning: 'Shrani plainKey na varno mesto — ne bo več prikazan.',
      }, { status: 201 })
    }

    if (input.action === 'revoke') {
      if (!input.keyId) {
        return NextResponse.json({ error: 'keyId je obvezen za revoke' }, { status: 400 })
      }
      const success = await revokeApiKey(input.keyId)
      return NextResponse.json({ success })
    }

    if (input.action === 'delete') {
      if (!input.keyId) {
        return NextResponse.json({ error: 'keyId je obvezen za delete' }, { status: 400 })
      }
      const success = await deleteApiKey(input.keyId)
      return NextResponse.json({ success })
    }

    if (input.action === 'rotate') {
      if (!input.keyId) {
        return NextResponse.json({ error: 'keyId je obvezen za rotate' }, { status: 400 })
      }
      const result = await rotateApiKey(input.keyId)
      if (!result) {
        return NextResponse.json({ error: 'Ključ ni najden' }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        key: {
          id: result.id,
          name: result.name,
          keyPrefix: result.keyPrefix,
          scopes: result.scopes,
        },
        plainKey: result.plainKey,
        warning: 'Stari ključ je bil revoke-an. Shrani novi plainKey na varno mesto.',
      })
    }

    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (err) {
    return handleApiError(err, 'security-audit POST')
  }
}

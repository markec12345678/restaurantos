// ============================================
// ROTACIJA API KLJUČEV — Varno spreminjanje ključev za integracije
// POST /api/integrations/[id]/rotate-key
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import crypto from 'crypto'


const rotateKeySchema = z.object({
  field: z.enum(['apiKey', 'apiSecret']),
  newValue: z.string().min(1).max(500).optional(),
  autoGenerate: z.boolean().default(false),
})

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const { data, error: validationError } = await validateRequest(req, rotateKeySchema)
    if (validationError) return validationError

    const { field, newValue, autoGenerate } = data

    // Preveri, da integracija obstaja
    const integration = await db.integration.findUnique({ where: { id } })
    if (!integration) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // Generiraj nov ključ če je autoGenerate
    const keyValue = autoGenerate
      ? `ros_${field === 'apiKey' ? 'ak' : 'sk'}_${crypto.randomBytes(24).toString('hex')}`
      : newValue

    if (!keyValue) {
      return NextResponse.json({ error: 'Navedi novo vrednost ali omogoči autoGenerate' }, { status: 400 })
    }

    // Posodobi ključ
    await db.integration.update({
      where: { id },
      data: { [field]: keyValue },
    })

    // Zabeleži v integracijski log
    await db.integrationLog.create({
      data: {
        integrationId: id,
        action: 'rotate_key',
        direction: 'outbound',
        status: 'success',
        statusCode: 200,
        requestData: JSON.stringify({ field, autoGenerate }),
        responseData: JSON.stringify({ rotated: true }),
        durationMs: 0,
      },
    })

    return NextResponse.json({
      success: true,
      field,
      maskedValue: `${keyValue.substring(0, 8)}••••••••`,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/integrations/[id]/rotate-key', 'Napaka pri rotaciji ključa')
  }
}

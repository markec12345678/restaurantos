
// Javni API za klic natakarja - BREZ avtentikacije
// Stranka skenira QR kodo na mizi in pokliče natakarja
// FIX CRITICAL: Rate limiting za preprečitev zlorabe

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'
import { checkRateLimitAsync, getClientIp, CALL_WAITER_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, validateRequest } from '@/lib/api-utils'

const callWaiterSchema = z.object({
  tableId: z.string().min(1).max(100, 'tableId preveč dolg'),
  message: z.string().max(200).default(''),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('call-waiter', clientIp, CALL_WAITER_LIMIT)
  if (!rateCheck.allowed) {
    return rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč klicev. Poskusite znova čez nekaj minut.')
  }

  try {
    const { data, error: validationError } = await validateRequest(req, callWaiterSchema)
    if (validationError) return validationError

    // Preveri, da miza obstaja
    const table = await db.table.findUnique({ where: { id: data.tableId } })
    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena' }, { status: 404 })
    }

    // Broadcast WebSocket obvestilo
    // WS AUDIT 2026-09-09: direkten globalThis klic (prej HTTP fetch 401) +
    // locationId mize za per-location dostavo (natakarji druge lokacije ne vidijo)
    wsBroadcastEvent('CALL_WAITER', {
      tableId: data.tableId,
      tableNumber: table.number,
      message: data.message || 'Stranka prosi za natakarja',
      timestamp: new Date().toISOString(),
      locationId: table.locationId ?? null,
    })

    // Revizijski dnevnik
    await createAuditLog({
      userId: 'qr-customer',
      action: 'CALL_WAITER',
      entityType: 'Table',
      entityId: data.tableId,
      details: {
        tableNumber: table.number,
        message: data.message,
      },
    })

    return NextResponse.json({ success: true, tableNumber: table.number })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/public/call-waiter', 'Napaka pri klicu natakarja')
  }
}

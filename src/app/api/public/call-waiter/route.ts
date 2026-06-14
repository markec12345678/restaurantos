
// Javni API za klic natakarja - BREZ avtentikacije
// Stranka skenira QR kodo na mizi in pokliče natakarja
// FIX CRITICAL: Rate limiting za preprečitev zlorabe

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAppUrl } from '@/lib/utils'
import { checkRateLimit, getClientIp, CALL_WAITER_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'
const callWaiterSchema = z.object({
  tableId: z.string().min(1).max(100, 'tableId preveč dolg'),
  message: z.string().max(200).default(''),
})

export async function POST(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('call-waiter', clientIp, CALL_WAITER_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč klicev. Poskusite znova čez nekaj minut.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
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
    try {
      await fetch(`${getAppUrl()}/api/ws-broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CALL_WAITER',
          payload: {
            tableId: data.tableId,
            tableNumber: table.number,
            message: data.message || 'Stranka prosi za natakarja',
            timestamp: new Date().toISOString(),
          },
        }),
      })
    } catch {
      // WS strežnik ni na voljo
    }

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

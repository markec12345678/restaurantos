import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Javni API za klic natakarja - BREZ avtentikacije
// Stranka skenira QR kodo na mizi in pokliče natakarja

const callWaiterSchema = z.object({
  tableId: z.string().min(1),
  message: z.string().max(200).default(''),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = callWaiterSchema.parse(body)

    // Preveri, da miza obstaja
    const table = await db.table.findUnique({ where: { id: data.tableId } })
    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena' }, { status: 404 })
    }

    // Broadcast WebSocket obvestilo
    try {
      await fetch('http://localhost:3000/api/ws-broadcast', {
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
  } catch (error) {
    console.error('[CALL WAITER] Napaka:', error)
    return NextResponse.json({ error: 'Napaka pri klicu natakarja' }, { status: 500 })
  }
}

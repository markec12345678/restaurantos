import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/public/verify-table?tableId=xxx
// Javen endpoint za preverjanje ali miza obstaja (za QR naročanje)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tableId = searchParams.get('tableId')

    if (!tableId) {
      return NextResponse.json({ exists: false }, { status: 400 })
    }

    const table = await db.table.findUnique({
      where: { id: tableId },
      select: { id: true, number: true, status: true }
    })

    if (!table) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      tableNumber: table.number,
      status: table.status,
    })
  } catch {
    return NextResponse.json({ exists: false }, { status: 500 })
  }
}

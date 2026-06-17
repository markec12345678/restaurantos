
// GET /api/public/verify-table?tableId=xxx
// Javen endpoint za preverjanje ali miza obstaja (za QR naročanje)
// FIX CRITICAL: Rate limiting za preprečitev enumeracije miz
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, VERIFY_TABLE_LIMIT } from '@/lib/rate-limit'


export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('verify-table', clientIp, VERIFY_TABLE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const tableId = searchParams.get('tableId')

    if (!tableId) {
      return NextResponse.json({ exists: false }, { status: 400 })
    }

    // FIX LOW: Validiraj format tableId — zavrni očitno neveljavne vnose
    if (!/^[a-z0-9]{5,50}$/i.test(tableId)) {
      return NextResponse.json({ exists: false })
    }

    const table = await db.table.findUnique({
      where: { id: tableId },
      select: { id: true, number: true, status: true }
    })

    if (!table) {
      // FIX LOW: Ne razlikuj med "ne obstaja" in "ni na voljo" — prepreči enumeracijo
      return NextResponse.json({ exists: false })
    }

    // FIX LOW: Ne vračaj statusa mize — omogoči napadalcu kartiranje stanja miz
    // Vrni samo tableNumber za prikaz v QR menu-ju
    return NextResponse.json({
      exists: true,
      tableNumber: table.number,
      // status: table.status, // ODSTRANJENO — ni potrebno za javni QR meni
    })
  } catch {
    return NextResponse.json({ exists: false }, { status: 500 })
  }
}

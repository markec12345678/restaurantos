// GET /api/tables/[id]/qr — Generiraj QR kodo (PNG) za mizo
// URL v QR kodi: https://tvojpos.si/qr/[tableId]
// Natakar izpiše QR nalepko za vsako mizo
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import QRCode from 'qrcode'
import { getAppUrl } from '@/lib/utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const table = await db.table.findUnique({ where: { id }, select: { id: true, number: true, area: true } })
    if (!table) return NextResponse.json({ error: 'Miza ni najdena' }, { status: 404 })

    // Generiraj URL za QR naročanje
    const baseUrl = getAppUrl()
    const qrUrl = `${baseUrl}/qr/${table.id}`

    // Generiraj QR kodo kot PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })

    // Vrni QR kodo kot PNG sliko
    return new NextResponse(new Uint8Array(qrBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="qr-miza-${table.number}.png"`,
        'Cache-Control': 'public, max-age=86400', // Cache 24h
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/tables/[id]/qr', 'Napaka pri generiranju QR kode')
  }
}

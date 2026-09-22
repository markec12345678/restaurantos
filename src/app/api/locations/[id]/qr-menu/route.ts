// GET /api/locations/[id]/qr-menu — R88-3: QR koda (PNG) za digitalni meni lokacije
// URL v QR kodi: https://tvojpos.si/qr-menu?locationId=<locationId>
//
// R88 zapira zanko iz R87-3: /qr-menu klient ŽE bere `?locationId` iz URL-ja
// (settings.id → body.locationId), do R88 pa NOBEN generator ni producent te
// URL oblike (obstojali so samo table QRji `/qr/[tableId]`). Zrcali
// src/app/api/tables/[id]/qr/route.ts (isti vzorec: requireAuth → resolver →
// scope → PNG + cache 24h).
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { isWithinScope, notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import QRCode from 'qrcode'
import { getAppUrl } from '@/lib/utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    // R88-3 (tenant scope): resolver TAKOJ po requireAuth (kanon) — QR kodo
    // generiraj SAMO za lokacijo v scope-u (regular/admin-with-location = svoja,
    // super-admin = katera koli prek izrecnega ?locationId).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/locations/[id]/qr-menu',
    })
    if ('error' in scope) return scope.error

    // R88-3: lokacija mora obstajati — unificiran 404 (ni oraklja obstoja),
    // isti vzorec kot tables/[id]/qr.
    const location = await db.location.findFirst({
      where: { id },
      select: { id: true, name: true, isActive: true },
    })
    if (!location) return notInScopeResponse('Lokacija')
    if (!isWithinScope(scope.locationId, location.id)) return notInScopeResponse('Lokacija')

    // R88-3: URL za digitalni meni (klient /qr-menu bere ?locationId iz URL-ja)
    const baseUrl = getAppUrl()
    const qrUrl = `${baseUrl}/qr-menu?locationId=${location.id}`

    // Generiraj QR kodo kot PNG buffer (iste nastavitve kot table QR)
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

    // Sanitiziraj ime lokacije za Content-Disposition (samo ASCII [a-z0-9-])
    const safeName =
      location.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'lokacija'

    // Vrni QR kodo kot PNG sliko
    return new NextResponse(new Uint8Array(qrBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="qr-meni-${safeName}.png"`,
        'Cache-Control': 'public, max-age=86400', // Cache 24h
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/locations/[id]/qr-menu', 'Napaka pri generiranju QR kode')
  }
}

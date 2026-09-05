
// Public QR Menu - no auth required
// FIX CRITICAL: Rate limiting za preprečitev zlorabe
// FIX P0-C3B: ?locationId je obvezen (public endpoint brez session)
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('qr-menu', clientIp, PUBLIC_MENU_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')

    // FIX P0-C3B: Public endpoint brez session — ?locationId je obvezen
    // Prej: menu.findMany({where:{isActive:true}}) je vrnil menije VSEH lokacij mešano
    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId parameter is required' },
        { status: 400 },
      )
    }

    const menus = await db.menu.findMany({
      where: { isActive: true, locationId },
      include: {
        categories: {
          include: {
            menuItems: {
              where: { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                modifierGroups: {
                  include: { modifierGroup: { include: { modifiers: { where: { isAvailable: true } } } } },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // FIX P0-C3B: Pridobi branding iz Location (vezano na locationId)
    // Prej: settings.findFirst brez filtra — globalni singleton
    const info = await getRestaurantInfoForLocation(locationId)
    const settings = {
      name: info.name,
      address: info.address,
      city: info.city,
      postCode: info.postCode,
      phone: info.phone,
      email: '',
      web: '',
      currency: info.currency,
      locale: info.locale,
      country: 'SI',
      allergenFilterEnabled: true,
      defaultVatRate: 22.00,
      reducedVatRate: 9.50,
    }

    return NextResponse.json({ menus, settings })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/qr-menu', 'Napaka pri nalaganju menija')
  }
}

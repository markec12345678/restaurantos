
// Public QR Menu - no auth required
// FIX CRITICAL: Rate limiting za preprečitev zlorabe
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('qr-menu', clientIp, PUBLIC_MENU_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    const menus = await db.menu.findMany({
      where: { isActive: true },
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

    // FIX Q05 MEDIUM: Vrni samo neobčutljive nastavitve — prepreči izpostavitev FURS certifikatov
    const settings = await db.restaurantSettings.findFirst({
      select: {
        name: true,
        address: true,
        city: true,
        postCode: true,
        phone: true,
        email: true,
        web: true,
        currency: true,
        locale: true,
        country: true,
        allergenFilterEnabled: true,
        defaultVatRate: true,
        reducedVatRate: true,
      },
    })

    return NextResponse.json({ menus, settings })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/qr-menu', 'Napaka pri nalaganju menija')
  }
}

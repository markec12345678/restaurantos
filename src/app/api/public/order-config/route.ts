
// =====================================================================
// PUBLIC ORDER CONFIG — Nastavitve za online naročanje
// Vrne: lokacije, cone dostave, delovni čas, ali je odprto
// GET /api/public/order-config
// FIX CRITICAL: Rate limiting za preprečitev zlorabe
// FIX HIGH: Ne izpostavljaj internih ID-jev v javnem API-ju
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { checkRateLimit, getClientIp, ORDER_CONFIG_LIMIT } from '@/lib/rate-limit'
import { toNum } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // FIX CRITICAL: Rate limiting
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('order-config', clientIp, ORDER_CONFIG_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov. Poskusite znova čez nekaj sekund.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
    )
  }

  try {
    // Pridobi lokacije
    const locations = await db.location.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        city: true,
        phone: true,
        isOpen: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: 'asc' },
    })

    // Pridobi cone dostave
    const deliveryZones = await db.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    // Pridobi delovni čas
    const openingHours = await db.openingHours.findMany({
      orderBy: { dayOfWeek: 'asc' },
    })

    // Nastavitve restavracije
    const settings = await db.restaurantSettings.findFirst({
      where: { isActive: true },
      select: {
        name: true,
        address: true,
        city: true,
        phone: true,
        currency: true,
      },
    })

    // Izračunaj ali je trenutno odprto
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=nedelja
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const todayHours = openingHours.find(h => h.dayOfWeek === dayOfWeek)
    let isOpenNow = false

    if (todayHours) {
      if (todayHours.isClosed) {
        isOpenNow = false
      } else {
        isOpenNow = currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime
        if (todayHours.breakStart && todayHours.breakEnd) {
          if (currentTime >= todayHours.breakStart && currentTime <= todayHours.breakEnd) {
            isOpenNow = false
          }
        }
      }
    } else {
      isOpenNow = true // Privzeto odprto če ni definiranega urnika
    }

    // Delovni čas po dnevih za prikaz
    const dayNames = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
    const weeklyHours = dayNames.map((day, idx) => {
      const hours = openingHours.find(h => h.dayOfWeek === idx)
      if (!hours || hours.isClosed) {
        return { day, isClosed: true, openTime: '', closeTime: '' }
      }
      return {
        day,
        isClosed: false,
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        breakStart: hours.breakStart || '',
        breakEnd: hours.breakEnd || '',
      }
    })

    return NextResponse.json({
      // FIX HIGH: Ne izpostavljaj internih ID-jev, lokacijskih koordinat in internih telefonskih številk
      locations: locations.map(l => ({
        code: l.code,
        name: l.name,
        address: l.address,
        city: l.city,
        isOpen: l.isOpen,
      })),
      // FIX HIGH: Ne izpostavljaj zone.id, locationId, raw Decimal polj
      deliveryZones: deliveryZones.map(z => ({
        name: z.name,
        deliveryFee: toNum(z.deliveryFee),
        minOrderAmount: toNum(z.minOrderAmount),
        freeDeliveryAbove: toNum(z.freeDeliveryAbove),
        estimatedMinutes: z.estimatedMinutes,
        locationCode: locations.find(l => l.id === z.locationId)?.code || null,
      })),
      isOpenNow,
      weeklyHours,
      settings: settings ? {
        name: settings.name,
        address: settings.address,
        city: settings.city,
        currency: settings.currency,
      } : null,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/order-config', 'Napaka pri pridobivanju nastavitev')
  }
}

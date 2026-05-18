import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// =====================================================================
// PUBLIC ORDER CONFIG — Nastavitve za online naročanje
// Vrne: lokacije, cone dostave, delovni čas, ali je odprto
// GET /api/public/order-config
// =====================================================================

export async function GET() {
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
      locations,
      deliveryZones: deliveryZones.map(z => ({
        id: z.id,
        name: z.name,
        postCodes: z.postCodes,
        cities: z.cities,
        deliveryFee: z.deliveryFee,
        minOrderAmount: z.minOrderAmount,
        freeDeliveryAbove: z.freeDeliveryAbove,
        estimatedMinutes: z.estimatedMinutes,
        locationId: z.locationId,
      })),
      isOpenNow,
      weeklyHours,
      settings,
    })
  } catch (error) {
    console.error('Order config error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju nastavitev' }, { status: 500 })
  }
}

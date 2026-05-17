import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'

// GET /api/happy-hour — pridobi vse urnike + trenutno aktivni
export async function GET() {
  try {
    const schedules = await db.happyHourSchedule.findMany({
      where: { isActive: true },
      include: { priceGroup: true },
      orderBy: { startTime: 'asc' },
    })

    // Preveri, kateri so trenutno aktivni
    const now = new Date()
    const currentDay = now.getDay() === 0 ? 7 : now.getDay() // 1=pon, 7=ned
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const activeSchedules = schedules.filter((s) => {
      const days: number[] = JSON.parse(s.daysOfWeek || '[]')
      if (!days.includes(currentDay)) return false
      if (currentTime < s.startTime || currentTime >= s.endTime) return false
      if (s.validFrom && now < s.validFrom) return false
      if (s.validTo && now > s.validTo) return false
      return true
    })

    return NextResponse.json({
      schedules,
      activeSchedules,
      currentlyActive: activeSchedules.length > 0,
      activePriceGroupIds: activeSchedules.map((s) => s.priceGroupId),
    })
  } catch (error) {
    console.error('Napaka pri pridobivanju Happy Hour:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju Happy Hour' }, { status: 500 })
  }
}

// POST /api/happy-hour — ustvari nov urnik
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    const schedule = await db.happyHourSchedule.create({
      data: {
        name: body.name,
        description: body.description || '',
        priceGroupId: body.priceGroupId,
        discountType: body.discountType || 'none',
        discountAmount: body.discountAmount || 0,
        daysOfWeek: JSON.stringify(body.daysOfWeek || [1, 2, 3, 4, 5]),
        startTime: body.startTime,
        endTime: body.endTime,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validTo: body.validTo ? new Date(body.validTo) : null,
        appliesTo: body.appliesTo || 'all',
        appliesToIds: JSON.stringify(body.appliesToIds || []),
        isActive: body.isActive ?? true,
        autoActivate: body.autoActivate ?? true,
      },
      include: { priceGroup: true },
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju Happy Hour:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju Happy Hour' }, { status: 500 })
  }
}

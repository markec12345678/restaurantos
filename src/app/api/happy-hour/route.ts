import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createHappyHourSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

// GET /api/happy-hour — pridobi vse urnike + trenutno aktivni
export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do Happy Hour podatkov
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

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

    // FIX CRITICAL: Zod validacija za Happy Hour urnik
    const { data, error: validationError } = validateBody(createHappyHourSchema, body)
    if (validationError) return validationError

    // FIX HIGH: Preveri, da startTime < endTime
    if (data.startTime >= data.endTime) {
      return NextResponse.json(
        { error: 'Začetni čas mora biti pred končnim časom' },
        { status: 400 }
      )
    }

    // FIX HIGH: Preveri, da priceGroupId obstaja
    if (data.priceGroupId) {
      const priceGroup = await db.priceGroup.findUnique({ where: { id: data.priceGroupId } })
      if (!priceGroup) {
        return NextResponse.json({ error: 'Cenik ni najden' }, { status: 404 })
      }
    }

    const schedule = await db.happyHourSchedule.create({
      data: {
        name: data.name,
        description: data.description || '',
        priceGroupId: data.priceGroupId,
        discountType: data.discountType || 'none',
        discountAmount: data.discountAmount || 0,
        daysOfWeek: JSON.stringify(data.daysOfWeek || [1, 2, 3, 4, 5]),
        startTime: data.startTime,
        endTime: data.endTime,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
        appliesTo: data.appliesTo || 'all',
        appliesToIds: JSON.stringify(data.appliesToIds || []),
        isActive: data.isActive ?? true,
        autoActivate: data.autoActivate ?? true,
      },
      include: { priceGroup: true },
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju Happy Hour:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju Happy Hour' }, { status: 500 })
  }
}

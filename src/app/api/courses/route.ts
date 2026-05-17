import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za kurse
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: 'orderId je obvezen' }, { status: 400 })
    }

    const courses = await db.course.findMany({
      where: { orderId },
      include: { orderItems: { include: { menuItem: true } } },
      orderBy: { courseNumber: 'asc' },
    })

    return NextResponse.json(courses)
  } catch (error) {
    console.error('Napaka pri pridobivanju kursov:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju kursov' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za ustvarjanje kurse
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    if (!body.orderId) {
      return NextResponse.json({ error: 'orderId je obvezen' }, { status: 400 })
    }

    const course = await db.course.create({
      data: {
        orderId: body.orderId,
        courseNumber: body.courseNumber || 1,
        name: body.name || '',
        status: 'pending',
        pacingNote: body.pacingNote || '',
      },
      include: { orderItems: true },
    })

    return NextResponse.json(course, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju kursa:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju kursa' }, { status: 500 })
  }
}

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// Zod validacijska shema za kreiranje kursa
const createCourseSchema = z.object({
  orderId: z.string().min(1, 'ID naročila je obvezen').max(100, 'ID naročila ne sme preseči 100 znakov'),
  courseNumber: z.number().int().min(1, 'Številka kursa mora biti vsaj 1').default(1),
  name: z.string().max(100, 'Ime ne sme preseči 100 znakov').default(''),
  pacingNote: z.string().max(500, 'Opomba ne sme preseči 500 znakov').default(''),
})

// Zod validacijska shema za iskanje kursov
const getCoursesSchema = z.object({
  orderId: z.string().min(1, 'ID naročila je obvezen').max(100, 'ID naročila ne sme preseči 100 znakov'),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za kurse
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')

    const parsed = getCoursesSchema.safeParse({ orderId })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni parametri', validationErrors: parsed.error.issues.map(e => ({ field: e.path.join('.'), message: e.message })) },
        { status: 400 }
      )
    }

    const courses = await db.course.findMany({
      where: { orderId: parsed.data.orderId },
      include: { orderItems: { include: { menuItem: true } } },
      orderBy: { courseNumber: 'asc' },
    })

    return NextResponse.json(courses)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/courses', 'Napaka pri pridobivanju kursov')
  }
}

export async function POST(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za ustvarjanje kurse
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, createCourseSchema)
    if (validationError) return validationError

    const { orderId, courseNumber, name, pacingNote } = data

    const course = await db.course.create({
      data: {
        orderId,
        courseNumber,
        name,
        status: 'pending',
        pacingNote,
      },
      include: { orderItems: true },
    })

    return NextResponse.json(course, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/courses', 'Napaka pri ustvarjanju kursa')
  }
}

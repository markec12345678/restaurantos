import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// Shema za posodobitev kursa — podpira akcije (fire/ready/served) in urejanje polj
const updateCourseSchema = z.object({
  action: z.enum(['fire', 'ready', 'served'], { message: 'Neveljavna akcija' }).optional(),
  name: z.string().min(1, 'Ime je obvezno').max(100, 'Ime ne sme preseči 100 znakov').optional(),
  courseNumber: z.number().int().min(1, 'Številka kursa mora biti vsaj 1').max(50, 'Številka kursa ne sme preseči 50').optional(),
  pacingNote: z.string().max(500, 'Opomba o tempu ne sme preseči 500 znakov').optional(),
})

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const result = await validateRequest(req, updateCourseSchema)
    if (result.error) return result.error

    const body = result.data

    // FIX HIGH: Preveri, da course obstaja
    const existing = await db.course.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Course ni najden' }, { status: 404 })
    }

    // FIX HIGH: State machine validacija za course statuse
    const validCourseTransitions: Record<string, string[]> = {
      pending: ['fired', 'cancelled'],
      fired: ['ready', 'cancelled'],
      ready: ['served'],
      served: [],
      cancelled: [],
    }

    const updateData: Record<string, unknown> = {}

    if (body.action === 'fire') {
      // Preveri veljaven prehod
      if (!validCourseTransitions[existing.status]?.includes('fired')) {
        return NextResponse.json({
          error: `Neveljaven prehod: ${existing.status} → fired`,
          currentStatus: existing.status,
        }, { status: 400 })
      }
      updateData.status = 'fired'
      updateData.firedAt = new Date()
    } else if (body.action === 'ready') {
      if (!validCourseTransitions[existing.status]?.includes('ready')) {
        return NextResponse.json({
          error: `Neveljaven prehod: ${existing.status} → ready`,
          currentStatus: existing.status,
        }, { status: 400 })
      }
      updateData.status = 'ready'
      updateData.readyAt = new Date()
    } else if (body.action === 'served') {
      if (!validCourseTransitions[existing.status]?.includes('served')) {
        return NextResponse.json({
          error: `Neveljaven prehod: ${existing.status} → served`,
          currentStatus: existing.status,
        }, { status: 400 })
      }
      updateData.status = 'served'
      updateData.servedAt = new Date()
    } else {
      if (body.name !== undefined) updateData.name = body.name
      if (body.courseNumber !== undefined) updateData.courseNumber = body.courseNumber
      if (body.pacingNote !== undefined) updateData.pacingNote = body.pacingNote
    }

    // FIX HIGH: Ovij course + orderItems update v transakcijo — atomarnost
    const course = await db.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { id },
        data: updateData,
        include: { orderItems: { include: { menuItem: true } } },
      })

      // Posodobi orderItems status, če je action
      if (body.action === 'fire') {
        await tx.orderItem.updateMany({
          where: { courseId: id },
          data: { status: 'fired' },
        })
      } else if (body.action === 'ready') {
        await tx.orderItem.updateMany({
          where: { courseId: id },
          data: { status: 'ready' },
        })
      } else if (body.action === 'served') {
        await tx.orderItem.updateMany({
          where: { courseId: id },
          data: { status: 'served' },
        })
      }

      return updated
    })

    return NextResponse.json(deepToNumbers(course))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/courses/[id]', 'Napaka pri posodabljanju kursa')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // FIX HIGH: Preveri, da course obstaja
    const existing = await db.course.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Course ni najden' }, { status: 404 })
    }

    // Remove course from order items in transaction
    await db.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { courseId: id },
        data: { courseId: null },
      })
      await tx.course.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/courses/[id]', 'Napaka pri brisanju kursa')
  }
}

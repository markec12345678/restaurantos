import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// Shema za posodobitev kursa — podpira akcije (fire/ready/served) in urejanje polj
const updateCourseSchema = z.object({
  action: z.enum(['fire', 'ready', 'served', 'hold', 'unhold'], { message: 'Neveljavna akcija' }).optional(),
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
    // FIX IDOR (tenant scope): najdi SAMO course, ki pripada session lokaciji
    // (veriga: Course → Order → locationId)
    // R86-2b (M2 razred): prej raw spread `session?.locationId ?? undefined` —
    // fail-open za non-admin seja z NULL lokacijo (cross-tenant fire/ready/
    // served prehod + orderItem.updateMany tujega naročila). Resolver.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PUT /api/courses/[id]',
    })
    if ('error' in scope) return scope.error
    const existing = await db.course.findFirst({
      where: { id, ...(scope.locationId ? { order: { locationId: scope.locationId } } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Course ni najden' }, { status: 404 })
    }

    // FIX HIGH: State machine validacija za course statuse
    // R134 (P1-10, kanon 4): dopolnjen z 'held' — pending<->held (hold/unhold),
    // held→fired (eksplicitni fire na zadržan tok je DOVOLJEN), held→cancelled.
    const validCourseTransitions: Record<string, string[]> = {
      pending: ['fired', 'cancelled', 'held'],
      held: ['fired', 'cancelled', 'pending'],
      fired: ['ready', 'cancelled'],
      ready: ['served'],
      served: [],
      cancelled: [],
    }

    // R134: akcija → ciljni status (hold/unhold sta aditivna)
    const actionTargets: Record<string, string> = {
      fire: 'fired',
      ready: 'ready',
      served: 'served',
      hold: 'held',
      unhold: 'pending',
    }

    const updateData: Record<string, unknown> = {}
    // R134 (kanon 5): en strežniški `now` za course IN orderItem žig (isti trenutek)
    const now = new Date()
    const target = body.action ? actionTargets[body.action] : null
    // R134: replay NO-OP velja SAMO za status akcije (kanon 6); hold/unhold imata
    // STROG kanon 4 ("hold/unhold na non-pending/non-held → 400").
    const isStateAction = body.action === 'fire' || body.action === 'ready' || body.action === 'served'

    if (target) {
      // R134 (kanon 6): IDEMPOTENT REPLAY — fire na fired / ready na ready /
      // served na served → 200 z trenutnim stanjem (NO-OP, NE 400; retry-varno:
      // "refresh ne sme izgubiti course state"). Ne piše firedAt/readyAt znova
      // (prvi fire/ready čas ostane avtoritativen — razliko od OVERWRITE
      // semantike item-level R133 določa kanon 6: course replay je NO-OP).
      if (isStateAction && existing.status === target) {
        const current = await db.course.findFirst({
          where: { id, ...(scope.locationId ? { order: { locationId: scope.locationId } } : {}) },
          include: { orderItems: { include: { menuItem: true } } },
        })
        if (!current) {
          return NextResponse.json({ error: 'Course ni najden' }, { status: 404 })
        }
        return NextResponse.json(deepToNumbers(current), { status: 200 })
      }

      // Preveri veljaven prehod (neveljaven → 400 z currentStatus)
      if (!validCourseTransitions[existing.status]?.includes(target)) {
        return NextResponse.json({
          error: `Neveljaven prehod: ${existing.status} → ${target}`,
          currentStatus: existing.status,
        }, { status: 400 })
      }

      if (body.action === 'fire') {
        updateData.status = 'fired'
        updateData.firedAt = now
      } else if (body.action === 'ready') {
        updateData.status = 'ready'
        updateData.readyAt = now
      } else if (body.action === 'served') {
        updateData.status = 'served'
        updateData.servedAt = now
      } else if (body.action === 'hold') {
        // R134 (kanon 4): pending → held. BREZ item propagacije (itemi ostanejo
        // pending — zadržan tok se ne požge sam od sebe; fire next/all ga
        // preskočita dokler ni unhold-an ali eksplicitno fire-an).
        updateData.status = 'held'
      } else if (body.action === 'unhold') {
        updateData.status = 'pending'
      }
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

      // R134 (kanon 5): propagacija na orderItems v ISTI transakciji — fire
      // piše tudi firedAt (prej manjkalo → KDS časovnik pokvarjen), ready piše
      // tudi readyAt (R133 pariteta), served SAMO status (servedAt je
      // course-level). hold/unhold NE propagirata (kanon 4).
      if (body.action === 'fire') {
        await tx.orderItem.updateMany({
          where: { courseId: id },
          data: { status: 'fired', firedAt: now },
        })
      } else if (body.action === 'ready') {
        await tx.orderItem.updateMany({
          where: { courseId: id },
          data: { status: 'ready', readyAt: now },
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
    // FIX IDOR (tenant scope): izbriši SAMO course znotraj session lokacije
    // R86-2b (M2 razred): raw spread `?? undefined` → resolver (fail-closed).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/courses/[id]',
    })
    if ('error' in scope) return scope.error
    const existing = await db.course.findFirst({
      where: { id, ...(scope.locationId ? { order: { locationId: scope.locationId } } : {}) },
    })
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

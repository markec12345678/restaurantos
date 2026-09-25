// ============================================
// R134 / EPIC #115 P1-10 — POST /api/orders/[id]/courses/fire
// FIRE NEXT / FIRE ALL (kanon 7 kontrakta R134)
// ============================================
// body { mode: 'next' | 'all' }:
//   next = požge course z NAJMANJŠIM courseNumber med status='pending'
//          ('held' PRESKOČENI — zadržan tok kuharja ne požge avtomatika).
//   all  = požge VSE pending ('held' preskočeni) v ENI $transaction,
//          ISTI firedAt za vse.
// - Course fire propagira na orderItems (kanon 5): status='fired' + firedAt
//   (strežniški čas, NIKOLI client) v ISTI transakciji.
// - Scope: order mora obstajati v lokacijskem scope-u (tuja/neznana → 404,
//   pariteta ostalih order pod-rut: add-items/transfer/dossier).
// - No-op (ni kandidatov) → 200 { firedCourseId: null } oz. { firedCourseIds: [] }
//   (NO-OP je uspeh, ne napaka — retry-varno, kanon 6).
// - Audit 'COURSE_FIRE' (pariteta WASTE_CREATE — best-effort mimo tx).
// - NIKOLI ne ustvari KOT dokumenta (kontrakt kanon 12 — dokumentirana
//   omejitev; KDS vidi iteme prek statusa 'fired').
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

const fireSchema = z.object({
  mode: z.enum(['next', 'all'], { message: 'Neveljaven način (next ali all)' }),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const result = await validateRequest(req, fireSchema)
    if (result.error) return result.error
    const { mode } = result.data

    // Tenant scope (kanon 9): fail-closed za ne-admina brez lokacije
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/orders/[id]/courses/fire',
    })
    if ('error' in scope) return scope.error

    // Order scope guard (pariteta add-items/transfer/dossier: tuja/neznana
    // naročila = isti 404, brez oraklja)
    const order = await db.order.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      select: { id: true, orderNumber: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // Kandidati: SAMO status='pending' ('held' izključen — kanon 4).
    // next = prvi po courseNumber asc (najmanjša številka).
    const pendingCourses = await db.course.findMany({
      where: { orderId: id, status: 'pending' },
      orderBy: { courseNumber: 'asc' },
    })

    if (pendingCourses.length === 0) {
      // No-op — uspeh (kanon 6: NO-OP ni napaka)
      return NextResponse.json(
        mode === 'next'
          ? { firedCourseId: null, courses: [] }
          : { firedCourseIds: [], courses: [] },
        { status: 200 },
      )
    }

    const now = new Date()
    const targets = mode === 'next' ? [pendingCourses[0]] : pendingCourses

    // Ena $transaction za vse požgane toke; ISTI `now` firedAt za vse (kanon 7).
    // CAS (updateMany + count, R112 kanon): vzporedni fire ne prezapiše
    // firedAt — course, ki ni več pending, se preskoči.
    const firedCourses = await db.$transaction(async (tx) => {
      const out: Array<Record<string, unknown>> = []
      for (const course of targets) {
        const cas = await tx.course.updateMany({
          where: { id: course.id, status: 'pending' },
          data: { status: 'fired', firedAt: now },
        })
        if (cas.count === 0) continue // race: že fire-an/hold-an/cancelled
        await tx.orderItem.updateMany({
          where: { courseId: course.id },
          data: { status: 'fired', firedAt: now },
        })
        const updated = await tx.course.findUnique({
          where: { id: course.id },
          include: { orderItems: { include: { menuItem: true } } },
        })
        if (updated) out.push(updated)
      }
      return out
    })

    // Vse kandidate je med transakcijo požgal drug request → no-op odgovor
    if (firedCourses.length === 0) {
      return NextResponse.json(
        mode === 'next'
          ? { firedCourseId: null, courses: [] }
          : { firedCourseIds: [], courses: [] },
        { status: 200 },
      )
    }

    const firedCourseIds = firedCourses.map(c => String(c.id))

    // Audit (pariteta WASTE_CREATE — best-effort mimo tx: tx je že commitan)
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'COURSE_FIRE',
      entityType: 'Course',
      entityId: mode === 'next' ? firedCourseIds[0] : order.id,
      details: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        mode,
        courseNumbers: firedCourses.map(c => c.courseNumber),
        firedCourseIds,
        locationId: scope.locationId,
      },
      locationId: scope.locationId ?? undefined,
    })

    return NextResponse.json(deepToNumbers(
      mode === 'next'
        ? { firedCourseId: firedCourseIds[0], courses: firedCourses }
        : { firedCourseIds, courses: firedCourses },
    ), { status: 200 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/orders/[id]/courses/fire', 'Napaka pri požiganju tokov')
  }
}

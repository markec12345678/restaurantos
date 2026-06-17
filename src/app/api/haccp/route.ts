
// GET /api/haccp — Pridobi HACCP vnose
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createHaccpSchema, haccpUpdateSchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX BUG 12: Zahtevaj avtentikacijo za HACCP
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where: Record<string, unknown> = {}
    // FIX CRITICAL: Privzeto prikaži samo aktivne (ne arhivirane) vnose — arhivirani so za inšpekcijo
    if (!searchParams.get('includeArchived')) {
      where.status = { not: 'archived' }
    }
    if (category) where.category = category
    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      }
    }

    // FIX MEDIUM: Paginacija za HACCP vnose — prepreči nalaganje vseh zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '200')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 200 : rawLimit, 1000)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const [entries, total] = await Promise.all([
      db.haccpEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.haccpEntry.count({ where }),
    ])

    return NextResponse.json({ entries, total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/haccp', 'Napaka pri pridobivanju HACCP vnosov')
  }
}

// POST /api/haccp — Dodaj HACCP vnos
export async function POST(req: Request) {
  try {
    // FIX BUG 12: Zahtevaj avtentikacijo za HACCP (admin)
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createHaccpSchema)
    if (validationError) return validationError

    // FIX F5-8: Kriptografska zaščita — hash chain za HACCP evidence (EU 852/2004)
    const lastEntry = await db.haccpEntry.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { chainHash: true },
    })
    const previousHash = lastEntry?.chainHash || ''
    const entryDate = data.date ? new Date(data.date) : new Date()
    const hashPayload = [previousHash, data.title, data.value, data.status, entryDate.toISOString()].join('|')
    const chainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

    const entry = await db.haccpEntry.create({
      data: {
        date: entryDate,
        category: data.category,
        title: data.title,
        description: data.description,
        value: data.value,
        status: data.status,
        correctiveAction: data.correctiveAction,
        employeeName: data.employeeName || authResult.session?.employeeId || '',
        previousHash,
        chainHash,
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/haccp', 'Napaka pri dodajanju HACCP vnosa')
  }
}

// PUT /api/haccp — Posodobi HACCP vnos
export async function PUT(req: Request) {
  try {
    // FIX BUG 12: Zahtevaj avtentikacijo za HACCP (admin)
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    // FIX REFACTOR: haccpUpdateSchema premaknjen v @/lib/validations za konsistentnost
    const { data, error: validationError } = await validateRequest(req, haccpUpdateSchema)
    if (validationError) return validationError

    // Preveri, da vnos obstaja
    const existing = await db.haccpEntry.findUnique({ where: { id: data.id } })
    if (!existing) {
      return NextResponse.json({ error: 'HACCP vnos ni najden' }, { status: 404 })
    }

    const entry = await db.haccpEntry.update({
      where: { id: data.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.value !== undefined && { value: data.value }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.correctiveAction !== undefined && { correctiveAction: data.correctiveAction }),
        ...(data.employeeName !== undefined && { employeeName: data.employeeName }),
      },
    })

    return NextResponse.json(entry)
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/haccp', 'Napaka pri posodabljanju HACCP vnosa')
  }
}

// DELETE /api/haccp — Izbriši HACCP vnos
export async function DELETE(req: Request) {
  try {
    // FIX BUG 12: Zahtevaj avtentikacijo za HACCP (admin)
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Potreben je ID vnosa' }, { status: 400 })
    }

    // FIX CRITICAL: HACCP zapisi so zakonsko zahtevani (EU 852/2004) — NE hard-delete!
    // Uporabi soft-archive namesto brisanja — ohrani zapis za inšpekcije
    const existing = await db.haccpEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'HACCP vnos ni najden' }, { status: 404 })
    }
    await db.haccpEntry.update({ where: { id }, data: { status: 'archived' } })
    return NextResponse.json({ success: true, message: 'HACCP vnos arhiviran' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/haccp', 'Napaka pri brisanju HACCP vnosa')
  }
}

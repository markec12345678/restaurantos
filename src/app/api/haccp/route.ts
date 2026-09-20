
// GET /api/haccp — Pridobi HACCP vnose
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { createHaccpSchema, haccpUpdateSchema } from '@/lib/validations'
import { handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'
import { createHaccpEntryWithChain } from '@/lib/haccp-chain'
import { resolveLocationId } from '@/lib/location-fallback'
import { notInScopeResponse } from '@/lib/tenant-scope'

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
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

    // FIX R80 (tenant scope): HaccpEntry IMA locationId, a je bil findMany+count
    // nefiltriran — cross-tenant food-safety zapisi. Scope na lokacijo seje;
    // super-admin (session.locationId=null) vidi vse lokacije.
    const sessionLocId = authResult.session?.locationId ?? null
    const locFilter = sessionLocId ? { locationId: sessionLocId } : {}

    const [entries, total] = await Promise.all([
      db.haccpEntry.findMany({
        where: { ...where, ...locFilter },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.haccpEntry.count({ where: { ...where, ...locFilter } }),
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

    // FIX F5-8 + FIX CRITICAL (race): Hash chain ZNOTRAJ transakcije.
    // Prejšnja koda je brala `lastEntry.chainHash` zunaj transakcije —
    // dva sočasna klica bi ustvarila razvejano verigo.
    const entryDate = data.date ? new Date(data.date) : new Date()
    // FIX QA runda 37: DB stolpec HaccpEntry.locationId je NOT NULL (schema drift) —
    // brez resolucije je create vrgel P2011 (Ana = admin brez session.locationId)
    const locationId = await resolveLocationId(
      authResult.session?.locationId,
      authResult.session?.employeeId,
    )
    const entry = await createHaccpEntryWithChain({
      date: entryDate,
      category: data.category,
      title: data.title,
      description: data.description,
      value: data.value,
      status: data.status,
      correctiveAction: data.correctiveAction,
      employeeName: data.employeeName || authResult.session?.employeeId || '',
      locationId,
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

    // FIX R81 (tenant scope, HIGH — runda 80 leftover): PUT/DELETE po ID sta bila
    // nescopecana — lokacijsko vezan admin je lahko spreminjal/arhiviral HACCP
    // (food-safety, EU 852/2004) vnose TUJIH tenantov. Scope iz seje (kanonični
    // vzorec gift-cards/[id]): location-bound admin sme samo vnose svoje lokacije;
    // legacy NULL locationId vrstice so fail-closed (404); super-admin
    // (session.locationId=null) ima cross-lokacijski nadzor.
    const sessionLocId = authResult.session?.locationId ?? null
    if (sessionLocId && existing.locationId !== sessionLocId) {
      return notInScopeResponse('HACCP vnos')
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

    return NextResponse.json(deepToNumbers(entry))
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
    // FIX R81 (tenant scope): isti guard kot PUT — arhiviranje tujega
    // HACCP vnosa (zbrisati/skriviti inšpekcijski zapis) je cross-tenant
    // WRITE. Fail-closed za legacy NULL locationId; super-admin unrestricted.
    const sessionLocId = authResult.session?.locationId ?? null
    if (sessionLocId && existing.locationId !== sessionLocId) {
      return notInScopeResponse('HACCP vnos')
    }
    await db.haccpEntry.update({ where: { id }, data: { status: 'archived' } })
    return NextResponse.json({ success: true, message: 'HACCP vnos arhiviran' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/haccp', 'Napaka pri brisanju HACCP vnosa')
  }
}

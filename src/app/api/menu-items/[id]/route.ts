
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { updateMenuItemSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { dedupeIds, attachmentScopeDecision } from '@/lib/modifier-attach'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Auth check
    // FIX R86-2c1 (LOW pariteta): PUT je zahteval samo take_orders (route
    // fallback), medtem ko POST zahteva manage_inventory — vsak natakar je
    // lahko spreminjal cene/artikle. Zdaj: ista permission zahteva kot POST.
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // 404 check before update
    // FIX IDOR (tenant scope): najdi SAMO artikel, ki pripada session lokaciji
    // (veriga: MenuItem → Category → Menu → locationId)
    // FIX R86-2c1 (M2): raw spread `?? undefined` je bil fail-open za non-admin
    // NULL-lokacijsko sejo — cross-tenant update cene/artikla. Zdaj: resolver.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PUT /api/menu-items/[id]',
    })
    if ('error' in scope) return scope.error
    const existing = await db.menuItem.findFirst({
      where: {
        id,
        ...(scope.locationId
          ? { category: { menu: { locationId: scope.locationId } } }
          : {}),
      },
      // RUNDA 70: potrebujemo artikelovo lokacijo za scope check skupin dodatkov
      select: { id: true, categoryId: true, category: { select: { menu: { select: { locationId: true } } } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // Zod validation
    const { data, error: validationError } = validateBody(updateMenuItemSchema, bodyResult.data)
    if (validationError) return validationError

    // RUNDA 70: scope check modifierGroupIds (PARITETA s POST — MODEL A #9).
    // Prej: PUT je sprejel skupino KATEREKOLI lokacije → cross-lokacijska vezava
    // možna prek PUT, čeprav POST jo blokira. Skupine morajo pripadati ISTI
    // lokaciji kot artikel (veriga MenuItem → Category → Menu → locationId).
    if (data.modifierGroupIds !== undefined) {
      const uniqueIds = dedupeIds(data.modifierGroupIds)
      let inScopeCount = 0
      if (uniqueIds.length > 0) {
        const itemLocationId = existing.category.menu.locationId
        const groupsInLocation = await db.modifierGroup.findMany({
          where: { id: { in: uniqueIds }, locationId: itemLocationId },
          select: { id: true },
        })
        inScopeCount = groupsInLocation.length
      }
      const decision = attachmentScopeDecision(uniqueIds.length, inScopeCount)
      if (!decision.allowed) {
        return NextResponse.json({ error: decision.messageSl }, { status: decision.status })
      }
    }

    // R133 (epic #115 P1-09): prepStationId vezava — PUT whitelist je polje
    // izpuščal (samo POST je pisal prek spread) → KDS postaja-routing in
    // metrike-target (PrepStation.avgPrepTime) sta v produkciji bila
    // nedosegljiva. Pariteta modifierGroupIds MODEL A #9: postaja mora biti
    // na ISTI lokaciji kot artikel (veriga MenuItem → Category → Menu →
    // locationId); null = odvezava (postaja ni več na voljo).
    if (data.prepStationId !== undefined && data.prepStationId !== null) {
      const station = await db.prepStation.findUnique({
        where: { id: data.prepStationId },
        select: { id: true, locationId: true },
      })
      const itemLocationId = existing.category.menu.locationId
      if (!station || station.locationId !== itemLocationId) {
        return NextResponse.json(
          { error: 'Postaja priprave ne pripada lokaciji artikla' },
          { status: 400 },
        )
      }
    }

    // MODEL A: premik artikla v DRUGO kategorijo — preveri, da ciljna kategorija
    // pripada meniju v ISTEM scope-u (sicer cross-lokacijski premik verige)
    if (data.categoryId !== undefined && data.categoryId !== existing.categoryId) {
      const target = await db.category.findUnique({
        where: { id: data.categoryId },
        select: { menu: { select: { locationId: true } } },
      })
      const targetLoc = target?.menu.locationId ?? null
      const scopeLocId = scope.locationId ?? null
      if (!target || (scopeLocId && targetLoc !== scopeLocId)) {
        return NextResponse.json({ error: 'Ciljna kategorija ni na voljo na tej lokaciji' }, { status: 404 })
      }
    }

    // Update modifier group associations and menu item in a transaction
    const item = await db.$transaction(async (tx) => {
      // Update modifier group associations if provided (RUNDA 70: dedupeIds —
      // duplikati v payloadu bi sprožili P2002 unique constraint)
      if (data.modifierGroupIds !== undefined) {
        const uniqueIds = dedupeIds(data.modifierGroupIds)
        await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId: id } })
        if (uniqueIds.length > 0) {
          await tx.menuItemModifierGroup.createMany({
            data: uniqueIds.map((groupId, i) => ({
              menuItemId: id,
              modifierGroupId: groupId,
              sortOrder: i,
            })),
          })
        }
      }

      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description
      if (data.price !== undefined) updateData.price = data.price
      if (data.image !== undefined) updateData.image = data.image
      if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
      // FIX MEDIUM: Dodana manjkajoča polja allergens in vatRate v update
      if (data.allergens !== undefined) updateData.allergens = data.allergens
      if (data.vatRate !== undefined) updateData.vatRate = data.vatRate
      // R133: prepStationId (scope guard zgoraj — fail-closed 400 čez lokacijo)
      if (data.prepStationId !== undefined) updateData.prepStationId = data.prepStationId

      return tx.menuItem.update({
        where: { id },
        data: updateData,
        include: {
          category: { include: { menu: { select: { id: true, name: true } } } },
          modifierGroups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              modifierGroup: { include: { modifiers: { orderBy: { sortOrder: 'asc' } } } },
            },
          },
        },
      })
    })

    return NextResponse.json(deepToNumbers(item))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/menu-items/[id]', 'Napaka pri posodobitvi artikla')
  }
}

// GET - Pridobi posamezen artikel (R95-d)
//
// R94 backlog (c): ruta je izvažala LE PUT/DELETE — GET je vračal 405
// (e2e MENU-3 forenzika). Produkcija (admin UI urejanje artikla) želi
// single-item fetch brez polnega menija. Kanon pariteta s PUT/DELETE:
//   - ista permission (manage_inventory),
//   - isti tenant resolver (veriga MenuItem → Category → Menu → locationId),
//   - enoten 404 brez obstoja-oraklja (tuji/neznani artikel = ISTI odgovor).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Auth check — pariteta s PUT/DELETE (R86-2c1 kanon)
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // Tenant scope (R90 canon): scoped filter, super-admin (null) = brez filtra
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/menu-items/[id]',
    })
    if ('error' in scope) return scope.error

    const item = await db.menuItem.findFirst({
      where: {
        id,
        ...(scope.locationId
          ? { category: { menu: { locationId: scope.locationId } } }
          : {}),
      },
      include: {
        category: { include: { menu: { select: { id: true, name: true } } } },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            modifierGroup: { include: { modifiers: { orderBy: { sortOrder: 'asc' } } } },
          },
        },
      },
    })
    if (!item) {
      // Enoten 404 — isti string kot PUT/DELETE (zero obstoja-orakelj)
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    return NextResponse.json(deepToNumbers(item))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/menu-items/[id]', 'Napaka pri pridobivanju artikla')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Auth check
    // FIX R86-2c1 (LOW pariteta): isti manage_inventory gate kot PUT/POST.
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // 404 check before delete
    // FIX IDOR (tenant scope): izbriši SAMO artikel, ki pripada session lokaciji
    // (veriga: MenuItem → Category → Menu → locationId)
    // FIX R86-2c1 (M2): raw spread `?? undefined` fail-open — cross-tenant
    // soft-delete (sabotaža tujega menija). Zdaj: resolver.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/menu-items/[id]',
    })
    if ('error' in scope) return scope.error
    const existing = await db.menuItem.findFirst({
      where: {
        id,
        ...(scope.locationId
          ? { category: { menu: { locationId: scope.locationId } } }
          : {}),
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // FIX MEDIUM: Soft-delete namesto hard-delete — prepreči crash če artikel ima OrderItems
    // Prisma ima onDelete: Restrict na OrderItem.menuItem, zato hard-delete crashne
    await db.menuItem.update({
      where: { id },
      data: { isAvailable: false },
    })
    return NextResponse.json({ success: true, message: 'Artikel onemogočen (soft-delete)' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/menu-items/[id]', 'Napaka pri brisanju artikla')
  }
}

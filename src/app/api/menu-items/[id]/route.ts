
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateMenuItemSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { dedupeIds, attachmentScopeDecision } from '@/lib/modifier-attach'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // 404 check before update
    // FIX IDOR (tenant scope): najdi SAMO artikel, ki pripada session lokaciji
    // (veriga: MenuItem → Category → Menu → locationId)
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const existing = await db.menuItem.findFirst({
      where: {
        id,
        ...(sessionLocationId
          ? { category: { menu: { locationId: sessionLocationId } } }
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

    // MODEL A: premik artikla v DRUGO kategorijo — preveri, da ciljna kategorija
    // pripada meniju v ISTEM scope-u (sicer cross-lokacijski premik verige)
    if (data.categoryId !== undefined && data.categoryId !== existing.categoryId) {
      const target = await db.category.findUnique({
        where: { id: data.categoryId },
        select: { menu: { select: { locationId: true } } },
      })
      const targetLoc = target?.menu.locationId ?? null
      const scope = authResult.session?.locationId ?? null
      if (!target || (scope && targetLoc !== scope)) {
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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // 404 check before delete
    // FIX IDOR (tenant scope): izbriši SAMO artikel, ki pripada session lokaciji
    // (veriga: MenuItem → Category → Menu → locationId)
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const existing = await db.menuItem.findFirst({
      where: {
        id,
        ...(sessionLocationId
          ? { category: { menu: { locationId: sessionLocationId } } }
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

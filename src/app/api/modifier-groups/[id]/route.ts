
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { updateModifierGroupSchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { sessionLocationId, isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'
import { canDeleteModifierGroup } from '@/lib/modifier-guard'
import { dedupeIds, attachmentScopeDecision } from '@/lib/modifier-attach'

export const dynamic = 'force-dynamic'

// MODEL A (#9): preveri, da skupina pripada scope-u seje, preden jo spreminjaš.
async function getGroupInScope(id: string, scope: string | null) {
  const group = await db.modifierGroup.findUnique({ where: { id }, select: { id: true, locationId: true } })
  if (!group) return { notFound: true as const }
  if (!isWithinScope(scope, group.locationId)) return { notFound: true as const }
  return { group }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // MODEL A (#9): scope guard — 404 tudi za tuje lokacije (ne razkrivaj obstoja)
    const inScope = await getGroupInScope(id, sessionLocationId(authResult))
    if ('notFound' in inScope) return notInScopeResponse('Skupina modifikatorjev')

    const bodyResult = await parseJsonBody(request)
    if (bodyResult.error) return bodyResult.error
    const body = bodyResult.data

    // FIX CRITICAL: Zod validacija — prepreči injection nepričakovanih polj
    const { data, error: validationError } = validateBody(updateModifierGroupSchema, body)
    if (validationError) return validationError

    // RUNDA 70: group-side attach — menuItemIds (prej validirana ampak TIHO
    // IGNORIRANA!). Zamenjava vezav v transakciji (vzorec PUT /api/menu-items):
    // deleteMany + createMany. Artikli morajo pripadati lokaciji skupine.
    const requestedItemIds = dedupeIds(data.menuItemIds ?? [])
    if (data.menuItemIds !== undefined) {
      let inScopeItemCount = 0
      if (requestedItemIds.length > 0) {
        const itemsInLocation = await db.menuItem.findMany({
          where: { id: { in: requestedItemIds }, category: { menu: { locationId: inScope.group.locationId } } },
          select: { id: true },
        })
        inScopeItemCount = itemsInLocation.length
      }
      const attachDecision = attachmentScopeDecision(requestedItemIds.length, inScopeItemCount)
      if (!attachDecision.allowed) {
        return NextResponse.json({ error: attachDecision.messageSl }, { status: attachDecision.status })
      }
    }

    // FIX BUG5: Wrap deleteMany + createMany in a transaction
    // Previously, if createMany failed after deleteMany, all modifiers were permanently deleted
    const modifierGroup = await db.$transaction(async (tx) => {
      if (data.modifiers) {
        // Delete existing modifiers and recreate — within transaction for atomicity
        await tx.modifier.deleteMany({ where: { modifierGroupId: id } })
      }

      // RUNDA 70: zamenjava vezav artiklov (deleteMany + createMany v isti transakciji)
      if (data.menuItemIds !== undefined) {
        await tx.menuItemModifierGroup.deleteMany({ where: { modifierGroupId: id } })
        if (requestedItemIds.length > 0) {
          await tx.menuItemModifierGroup.createMany({
            data: requestedItemIds.map((menuItemId, i) => ({
              modifierGroupId: id,
              menuItemId,
              sortOrder: i,
            })),
          })
        }
      }

      // Build update data from validated fields only
      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.required !== undefined) updateData.required = data.required
      if (data.minSelect !== undefined) updateData.minSelect = data.minSelect
      if (data.maxSelect !== undefined) updateData.maxSelect = data.maxSelect
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
      if (data.modifiers) {
        updateData.modifiers = {
          create: data.modifiers.map((m, i) => ({
            name: m.name,
            price: m.price,
            sortOrder: m.sortOrder ?? i,
          })),
        }
      }

      return tx.modifierGroup.update({
        where: { id },
        data: updateData,
        include: {
          modifiers: true,
          menuItems: { include: { menuItem: { select: { id: true, name: true } } } },
        },
      })
    })
    return NextResponse.json(deepToNumbers(modifierGroup))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/modifier-groups/[id]', 'Napaka pri posodobitvi skupine modifikatorjev')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // MODEL A (#9): scope guard — prej findUnique BREZ scopa (IDOR čez lokacije)
    const inScope = await getGroupInScope(id, sessionLocationId(authResult))
    if ('notFound' in inScope) return notInScopeResponse('Skupina modifikatorjev')

    // RUNDA 68: zaščita brisanja — join MenuItemModifierGroup kaskade, zato bi
    // goli delete TIHO odstranil vezavo dodatkov z vseh pripetih artiklov.
    // ENOTEN VIR (modifier-guard): 409 s slovenskim sporočilom namesto tihe izgube.
    const attachedItems = await db.menuItemModifierGroup.count({ where: { modifierGroupId: id } })
    const decision = canDeleteModifierGroup(attachedItems)
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.messageSl }, { status: decision.status })
    }

    await db.modifierGroup.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/modifier-groups/[id]', 'Napaka pri brisanju skupine modifikatorjev')
  }
}

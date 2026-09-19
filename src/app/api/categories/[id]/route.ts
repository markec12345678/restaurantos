
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { updateCategorySchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { sessionLocationId, isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'
import { canDeleteCategory } from '@/lib/category-guard'

export const dynamic = 'force-dynamic'

// ============================================
// RUNDA 66: /api/categories/[id] — GET / PUT / DELETE
// Model A: kategorija nima lastnega locationId — scope prek Menu verige.
// DELETE ima referenčno zaščito (canDeleteCategory): kategorija z artikli
// je blokirana (409) — artikli so živi podatki prodaje/fiscalnih računov.
// ============================================

/** Naloži kategorijo z menu.locationId za scope preverjanje. */
async function loadCategoryInScope(id: string, locationId: string | null) {
  const category = await db.category.findUnique({
    where: { id },
    select: { id: true, menu: { select: { id: true, locationId: true } } },
  })
  if (!category || !isWithinScope(locationId, category.menu.locationId)) return null
  return category
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const { id } = await params
    const category = await db.category.findUnique({
      where: { id },
      include: {
        menu: { select: { id: true, name: true, icon: true, locationId: true } },
        _count: { select: { menuItems: true } },
      },
    })
    // Scope (model A): neobstoječa IN izven-scope kategorija sta enako 404
    if (!category || !isWithinScope(sessionLocationId(authResult), category.menu.locationId)) {
      return notInScopeResponse('Kategorija')
    }
    // locationId je notranjost scope verige — v odgovoru NE razkrivamo
    const { menu: { locationId: _loc, ...menuPublic }, ...rest } = category
    return NextResponse.json(deepToNumbers({ ...rest, menu: menuPublic }))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/categories/[id]', 'Napaka pri pridobivanju kategorije')
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const existing = await loadCategoryInScope(id, sessionLocationId(authResult))
    if (!existing) return notInScopeResponse('Kategorija')

    const bodyResult = await parseJsonBody(request)
    if (bodyResult.error) return bodyResult.error
    const { data, error: validationError } = validateBody(updateCategorySchema, bodyResult.data)
    if (validationError) return validationError

    // Premik med meniji: ciljni meni mora obstajati IN biti v scope-u seje
    // (drugače bi PUT omogočil "tih" premik artiklov v tujo lokacijo).
    if (data.menuId !== undefined && data.menuId !== existing.menu.id) {
      const targetMenu = await db.menu.findUnique({
        where: { id: data.menuId },
        select: { id: true, locationId: true },
      })
      if (!targetMenu || !isWithinScope(sessionLocationId(authResult), targetMenu.locationId)) {
        return notInScopeResponse('Ciljni meni')
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.icon !== undefined) updateData.icon = data.icon
    if (data.color !== undefined) updateData.color = data.color
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
    if (data.menuId !== undefined) updateData.menuId = data.menuId

    const category = await db.category.update({ where: { id }, data: updateData })
    return NextResponse.json(deepToNumbers(category))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/categories/[id]', 'Napaka pri posodobitvi kategorije')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const existing = await loadCategoryInScope(id, sessionLocationId(authResult))
    if (!existing) return notInScopeResponse('Kategorija')

    // Referenčna zaščita (enoten vir z UI): kategorija z artikli → 409
    // z razumljivim slovenskim sporočilom (premakni artikle najprej).
    const itemCount = await db.menuItem.count({ where: { categoryId: id } })
    const decision = canDeleteCategory(itemCount)
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.messageSl }, { status: decision.status })
    }

    await db.category.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/categories/[id]', 'Napaka pri brisanju kategorije')
  }
}

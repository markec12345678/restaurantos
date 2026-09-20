
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { updatePackagingSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { resolveCatalogScope, notInScopeResponse } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // FIX R81-G (LEAK-HIGH, cross-tenant): PackagingConfig (MODEL A, locationId
    // NOT NULL) je bil bran prek findUnique po raw ID — vsak staff je lahko
    // bral konfiguracijo embalaže TUJE lokacije. MODEL A scope iz seje
    // (resolveCatalogScope: non-admin brez lokacije → 403, super-admin →
    // globalni pogled); findFirst z lokacijskim filtrom → 404 izven scope-a.
    const scopeRes = resolveCatalogScope(authResult)
    if (!scopeRes.ok) return scopeRes.response
    const sessionLocId = scopeRes.scope

    const { id } = await params

    const packagingConfig = await db.packagingConfig.findFirst({
      where: { id, ...(sessionLocId ? { locationId: sessionLocId } : {}) },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!packagingConfig) {
      return notInScopeResponse('Embalaža')
    }

    return NextResponse.json(deepToNumbers(packagingConfig))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/packaging/[id]', 'Napaka pri pridobivanju embalaže')
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R81-G (LEAK-HIGH): isti MODEL A scope gate kot GET zgoraj
    const scopeRes = resolveCatalogScope(authResult)
    if (!scopeRes.ok) return scopeRes.response
    const sessionLocId = scopeRes.scope

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX HIGH: Zod validacija za posodobitev pakiranja
    const { data, error: validationError } = validateBody(updatePackagingSchema, bodyResult.data)
    if (validationError) return validationError

    const existing = await db.packagingConfig.findFirst({
      where: { id, ...(sessionLocId ? { locationId: sessionLocId } : {}) },
    })
    if (!existing) {
      return notInScopeResponse('Embalaža')
    }

    // Prepare config-level update data
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    // Handle nested items update if provided
    if (data.items !== undefined) {
      // Delete existing items and recreate (cascade delete handled by schema)
      updateData.items = {
        deleteMany: {},
        create: data.items.map((item) => ({
          name: item.name,
          price: item.price,
          sortOrder: item.sortOrder,
        })),
      }
    }

    const packagingConfig = await db.packagingConfig.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(deepToNumbers(packagingConfig))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/packaging/[id]', 'Napaka pri posodabljanju embalaže')
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R81-G (LEAK-HIGH): isti MODEL A scope gate kot GET zgoraj
    const scopeRes = resolveCatalogScope(authResult)
    if (!scopeRes.ok) return scopeRes.response
    const sessionLocId = scopeRes.scope

    const { id } = await params

    const existing = await db.packagingConfig.findFirst({
      where: { id, ...(sessionLocId ? { locationId: sessionLocId } : {}) },
    })
    if (!existing) {
      return notInScopeResponse('Embalaža')
    }

    await db.packagingConfig.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/packaging/[id]', 'Napaka pri brisanju embalaže')
  }
}

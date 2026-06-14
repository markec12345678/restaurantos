// ============================================
// DOBAVITELJ — Posodobi / Izbriši / Pridobi
// Avtentikacija + Zod validacija
// ============================================

// GET - Pridobi posameznega dobavitelja
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateSupplierSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-06: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          include: { items: { include: { inventoryItem: { select: { id: true, name: true } } } } },
          orderBy: { orderDate: 'desc' },
          take: 10,
        },
      },
    })
    if (!supplier) return NextResponse.json({ error: 'Dobavitelj ni najden' }, { status: 404 })
    return NextResponse.json(supplier)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/suppliers/[id]', 'Napaka pri pridobivanju dobavitelja')
  }
}

// PUT - Posodobi dobavitelja
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-06: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Zod validacija namesto ročnega filtriranja polj
    const { data, error: validationError } = validateBody(updateSupplierSchema, bodyResult.data)
    if (validationError) return validationError

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Dobavitelj ni najden' }, { status: 404 })
    }

    const supplier = await db.supplier.update({
      where: { id },
      data,
    })

    return NextResponse.json(supplier)
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/suppliers/[id]', 'Napaka pri posodabljanju dobavitelja')
  }
}

// DELETE - Deaktiviraj dobavitelja (ne izbriši)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-06: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Dobavitelj ni najden' }, { status: 404 })
    }

    await db.supplier.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/suppliers/[id]', 'Napaka pri deaktivaciji dobavitelja')
  }
}

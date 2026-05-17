// ============================================
// DOBAVITELJ — Posodobi / Izbriši / Pridobi
// Avtentikacija + Zod validacija
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateSupplierSchema } from '@/lib/validations'

// GET - Pridobi posameznega dobavitelja
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
  } catch (error) {
    console.error('Napaka pri pridobivanju dobavitelja:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju dobavitelja' }, { status: 500 })
  }
}

// PUT - Posodobi dobavitelja
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-06: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    // FIX H-01: Zod validacija namesto ročnega filtriranja polj
    const { data, error: validationError } = validateBody(updateSupplierSchema, body)
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
  } catch (error) {
    console.error('Napaka pri posodabljanju dobavitelja:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju dobavitelja' }, { status: 500 })
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
  } catch (error) {
    console.error('Napaka pri deaktivaciji dobavitelja:', error)
    return NextResponse.json({ error: 'Napaka pri deaktivaciji dobavitelja' }, { status: 500 })
  }
}

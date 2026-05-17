// ============================================
// DOBAVITELJI — Profesionalna implementacija
// Toast POS standard — CRUD + iskanje + filtriranje
// Avtentikacija + Zod validacija
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createSupplierSchema } from '@/lib/validations'

// GET - Pridobi dobavitelje
export async function GET(req: Request) {
  try {
    // FIX C-06: Zahtevaj avtentikacijo za vpogled v dobavitelje
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const activeOnly = searchParams.get('active') !== 'false'

    const where: Record<string, unknown> = {}
    if (activeOnly) where.isActive = true
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { contactPerson: { contains: search } },
        { city: { contains: search } },
      ]
    }

    const suppliers = await db.supplier.findMany({
      where,
      include: {
        _count: { select: { purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error('Napaka pri pridobivanju dobaviteljev:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju dobaviteljev' }, { status: 500 })
  }
}

// POST - Ustvari dobavitelja
export async function POST(req: Request) {
  try {
    // FIX C-06: Zahtevaj avtentikacijo za ustvarjanje dobavitelja
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Zod validacija namesto ročne
    const { data, error: validationError } = validateBody(createSupplierSchema, body)
    if (validationError) return validationError

    const supplier = await db.supplier.create({
      data: {
        name: data.name,
        code: data.code,
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        postCode: data.postCode,
        country: data.country,
        businessId: data.businessId,
        taxId: data.taxId,
        iban: data.iban,
        bank: data.bank,
        paymentTerms: data.paymentTerms,
        deliveryDays: data.deliveryDays,
        minOrderAmount: data.minOrderAmount,
        rating: data.rating,
        isActive: data.isActive,
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju dobavitelja:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju dobavitelja' }, { status: 500 })
  }
}

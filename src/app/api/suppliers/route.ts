// ============================================
// DOBAVITELJI — Profesionalna implementacija
// Toast POS standard — CRUD + iskanje + filtriranje
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - Pridobi dobavitelje
export async function GET(req: Request) {
  try {
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
    const body = await req.json()

    // Validacija
    if (!body.name) {
      return NextResponse.json({ error: 'Ime dobavitelja je obvezno' }, { status: 400 })
    }

    const supplier = await db.supplier.create({
      data: {
        name: body.name,
        code: body.code || '',
        contactPerson: body.contactPerson || '',
        email: body.email || '',
        phone: body.phone || '',
        address: body.address || '',
        city: body.city || '',
        postCode: body.postCode || '',
        country: body.country || 'Slovenija',
        businessId: body.businessId || '',
        taxId: body.taxId || '',
        iban: body.iban || '',
        bank: body.bank || '',
        paymentTerms: body.paymentTerms || '30 dni',
        deliveryDays: body.deliveryDays || '[]',
        minOrderAmount: body.minOrderAmount || 0,
        rating: body.rating || 0,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju dobavitelja:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju dobavitelja' }, { status: 500 })
  }
}

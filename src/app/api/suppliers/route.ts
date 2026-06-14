// ============================================
// DOBAVITELJI — Profesionalna implementacija
// Toast POS standard — CRUD + iskanje + filtriranje
// Avtentikacija + Zod validacija
// ============================================

// GET - Pridobi dobavitelje
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createSupplierSchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'
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

    // FIX MEDIUM: Paginacija za dobavitelje — prepreči nalaganje vseh zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        include: {
          _count: { select: { purchaseOrders: true } },
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      db.supplier.count({ where }),
    ])

    return NextResponse.json({ suppliers, total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/suppliers', 'Napaka pri pridobivanju dobaviteljev')
  }
}

// POST - Ustvari dobavitelja
export async function POST(req: Request) {
  try {
    // FIX C-06: Zahtevaj avtentikacijo za ustvarjanje dobavitelja
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createSupplierSchema)
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
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/suppliers', 'Napaka pri ustvarjanju dobavitelja')
  }
}

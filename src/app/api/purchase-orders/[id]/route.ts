// ============================================
// NABAVNO NAROČILO — Posodobi / Pridobi
// Vključuje prevzem blaga z avtomatsko posodobitvijo zaloge
// Avtentikacija za vse operacije
// ============================================

// GET - Pridobi posamezno naročilo
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { purchaseOrderUpdateSchema, VALID_PO_TRANSITIONS, handleReceiveAction } from './_helpers'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-09: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { inventoryItem: true } } },
    })
    if (!po) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    return NextResponse.json(deepToNumbers(po))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/purchase-orders/[id]', 'Napaka pri pridobivanju naročila')
  }
}

// PUT - Posodobi naročilo / Prevzemi blago
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-09: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // FIX SECURITY: validateRequest prepreči oversized payload in sanatizira vnos
    const { data: body, error: validationError } = await validateRequest(req, purchaseOrderUpdateSchema)
    if (validationError) return validationError

    // Prevzem blaga — posodobi zalogo (v transakciji)
    if (body.action === 'receive' && body.receivedItems && body.receivedItems.length > 0) {
      return await handleReceiveAction(id, body.receivedItems, authResult.session?.employeeId)
    }

    // Navadna posodobitev
    const existing = await db.purchaseOrder.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

    // FIX HIGH: State machine validacija za status — prepreči neveljavne prehode
    if (body.status && body.status !== existing.status) {
      const allowed = VALID_PO_TRANSITIONS[existing.status] || []
      if (!allowed.includes(body.status)) {
        return NextResponse.json({
          error: `Neveljaven prehod statusa: ${existing.status} → ${body.status}`,
          allowedTransitions: allowed,
        }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.expectedDate) updateData.expectedDate = new Date(body.expectedDate)
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.approvedBy) updateData.approvedBy = body.approvedBy
    if (body.deliveryAddress !== undefined) updateData.deliveryAddress = body.deliveryAddress
    if (body.deliveryNotes !== undefined) updateData.deliveryNotes = body.deliveryNotes

    const po = await db.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: { supplier: true, items: { include: { inventoryItem: true } } },
    })

    return NextResponse.json(deepToNumbers(po))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/purchase-orders/[id]', 'Napaka pri posodabljanju naročila')
  }
}

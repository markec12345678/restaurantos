// ============================================
// NABAVNO NAROČILO — Posodobi / Pridobi
// Vključuje prevzem blaga z avtomatsko posodobitvijo zaloge
// Avtentikacija za vse operacije
// ============================================

// GET - Pridobi posamezno naročilo
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { toNum, round2, isPositive, greaterThanOrEqual, multiply, deepToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'
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
    const purchaseOrderUpdateSchema = z.object({
      action: z.enum(['receive']).optional(),
      receivedItems: z.array(z.object({
        itemId: z.string().max(100, 'ID postavke je predolg'),
        quantityReceived: z.number().min(0.01, 'Količina mora biti pozitivna').max(99999, 'Količina je prevelika'),
      })).max(100, 'Največ 100 postavk na prevzem').optional(),
      status: z.enum(['draft', 'submitted', 'approved', 'partial', 'received', 'cancelled']).optional(),
      expectedDate: z.string().max(30, 'Datum je predolg').optional(),
      notes: z.string().max(2000, 'Opombe so predolge').optional(),
      approvedBy: z.string().max(100, 'Odobritelj je predolg').optional(),
      deliveryAddress: z.string().max(500, 'Naslov dostave je predolg').optional(),
      deliveryNotes: z.string().max(2000, 'Opombe dostave so predolge').optional(),
    })

    const { data: body, error: validationError } = await validateRequest(req, purchaseOrderUpdateSchema)
    if (validationError) return validationError

    // Prevzem blaga — posodobi zalogo (v transakciji)
    if (body.action === 'receive' && body.receivedItems && body.receivedItems.length > 0) {
      const po = await db.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      })
      if (!po) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

      // FIX MEDIUM: Ovij prevzem v transakcijo — prepreči delne posodobitve zaloge
      await db.$transaction(async (tx) => {
        for (const receivedItem of body.receivedItems!) {
          const poItem = po.items.find(i => i.id === receivedItem.itemId)
          if (!poItem) continue

          // FIX H-03: Preveri, da količina ne presega naročene
          const totalReceived = toNum(poItem.quantityReceived) + receivedItem.quantityReceived
          if (totalReceived > toNum(poItem.quantityOrdered)) {
            throw new Error(`Postavka "${poItem.description}": prevzeta količina presega naročeno`)
          }

          // Posodobi postavko naročila
          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              quantityReceived: totalReceived,
              status: greaterThanOrEqual(totalReceived, poItem.quantityOrdered) ? 'received' : 'partial',
            },
          })

          // Posodobi zalogo, če je povezana
          if (poItem.inventoryItemId) {
            const invItem = await tx.inventoryItem.findUnique({
              where: { id: poItem.inventoryItemId },
            })
            if (invItem) {
              // FIX CRITICAL: Uporabi atomic increment namesto read-then-write — prepreči race condition
              const updatedInv = await tx.inventoryItem.update({
                where: { id: invItem.id },
                data: {
                  quantity: { increment: receivedItem.quantityReceived },
                  lastRestocked: new Date(),
                },
              })
              // Ustvari zalogo transakcijo
              await tx.stockTransaction.create({
                data: {
                  inventoryItemId: invItem.id,
                  type: 'procurement',
                  quantity: receivedItem.quantityReceived,
                  previousQty: toNum(updatedInv.quantity) - receivedItem.quantityReceived,
                  newQty: toNum(updatedInv.quantity),
                  costPerUnit: poItem.unitPrice,
                  totalCost: round2(multiply(receivedItem.quantityReceived, poItem.unitPrice)),
                  reason: `Naročilo ${po.poNumber}`,
                  supplierDoc: po.poNumber,
                  employeeName: authResult.session?.employeeId || '',
                },
              })
            }
          }
        }

        // Preveri ali je vse prejeto
        const updatedPo = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { items: true },
        })
        const allReceived = updatedPo?.items.every(i => greaterThanOrEqual(i.quantityReceived, i.quantityOrdered))
        const anyPartial = updatedPo?.items.some(i => isPositive(i.quantityReceived) && !greaterThanOrEqual(i.quantityReceived, i.quantityOrdered))

        await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: allReceived ? 'received' : anyPartial ? 'partial' : po.status,
            receivedDate: allReceived ? new Date() : null,
          },
        })
      })

      return NextResponse.json({ success: true, message: 'Blago prevzeto in zaloga posodobljena' })
    }

    // Navadna posodobitev
    const existing = await db.purchaseOrder.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

    // FIX HIGH: State machine validacija za status — prepreči neveljavne prehode
    if (body.status && body.status !== existing.status) {
      const validPOTransitions: Record<string, string[]> = {
        draft: ['submitted', 'cancelled'],
        submitted: ['approved', 'cancelled'],
        approved: ['partial', 'received', 'cancelled'],
        partial: ['received', 'cancelled'],
        received: [],
        cancelled: [],
      }
      const allowed = validPOTransitions[existing.status] || []
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

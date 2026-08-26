// NABAVNO NAROČILO — Schema + prevzem blaga helper

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { toNum, round2, greaterThanOrEqual, isPositive, multiply } from '@/lib/decimal'

export const purchaseOrderUpdateSchema = z.object({
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

// State machine validacija za status
export const VALID_PO_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved: ['partial', 'received', 'cancelled'],
  partial: ['received', 'cancelled'],
  received: [],
  cancelled: [],
}

// Prevzem blaga — posodobi zalogo (v transakciji)
export async function handleReceiveAction(
  id: string,
  receivedItems: { itemId: string; quantityReceived: number }[],
  employeeId?: string,
) {
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!po) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

  // FIX MEDIUM: Ovij prevzem v transakcijo — prepreči delne posodobitve zaloge
  await db.$transaction(async (tx) => {
    for (const receivedItem of receivedItems) {
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
              employeeName: employeeId || '',
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

    // FIX F5-5: Avtomatsko kreiraj AccountsPayable ob popolnem prejemu blaga
    // Poveže nabavno naročilo z obveznostjo do dobavitelja (AP aging)
    if (allReceived) {
      const year = new Date().getFullYear()
      const apCount = await tx.accountsPayable.count({ where: { apNumber: { startsWith: `AP-${year}-` } } })
      const apNumber = `AP-${year}-${String(apCount + 1).padStart(6, '0')}`
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30) // Default 30 dni plačila

      await tx.accountsPayable.create({
        data: {
          apNumber,
          supplierId: po.supplierId,
          purchaseOrderId: po.id,
          invoiceNumber: po.poNumber, // Uporabi PO kot referenco
          invoiceDate: new Date(),
          dueDate,
          subtotal: toNum(po.subtotal),
          vatAmount: toNum(po.vatAmount),
          totalAmount: toNum(po.totalAmount),
          status: 'open',
          notes: `Avtomatsko kreirano ob prejemu ${po.poNumber}`,
        },
      })
    }
  })

  return NextResponse.json({ success: true, message: 'Blago prevzeto in zaloga posodobljena' })
}

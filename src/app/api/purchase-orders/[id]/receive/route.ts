// POST /api/purchase-orders/[id]/receive — Prejem blaga (Goods Receipt)
// FIX BUG-PO-2: Ta endpoint prej ni obstajal — celoten receive flow je bil nedokončan.
//
// Sprejme seznam prejetih postavk (itemId + quantityReceived), posodobi zalogo
// in ustvari StockTransaction zapise. Ob popolnem prejemu avtomatsko ustvari
// AccountsPayable (obveznost do dobavitelja).
//
// Prav tako posodobi status PO-ja: partial (delno) ali received (popolnoma).
// FIX: Ustvari AuditLog za vsak prejem (revizijski dnevnik).

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { deepToNumbers, toNum, round2, greaterThanOrEqual, isPositive, multiply } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const receiveSchema = z.object({
  receivedItems: z.array(z.object({
    itemId: z.string().min(1, 'ID postavke je obvezen'),
    quantityReceived: z.number().min(0.01, 'Količina mora biti pozitivna').max(99999, 'Količina je prevelika'),
  })).min(1, 'Vsaj ena postavka je obvezna').max(100, 'Največ 100 postavk na prevzem'),
  notes: z.string().max(2000, 'Opombe so predolge').optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const { data: body, error: validationError } = await validateRequest(req, receiveSchema)
    if (validationError) return validationError

    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true, supplier: true },
    })
    if (!po) return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })

    // Prepreči prevzem že prejetega naročila
    if (po.status === 'received') {
      return NextResponse.json({ error: 'Naročilo je že popolnoma prejeto' }, { status: 400 })
    }

    // FIX MEDIUM: Ovij prevzem v transakcijo — prepreči delne posodobitve zaloge
    const result = await db.$transaction(async (tx) => {
      for (const receivedItem of body.receivedItems) {
        const poItem = po.items.find(i => i.id === receivedItem.itemId)
        if (!poItem) {
          throw new Error(`Postavka ${receivedItem.itemId} ni najdena v naročilu`)
        }

        // Preveri, da količina ne presega naročene
        const totalReceived = toNum(poItem.quantityReceived) + receivedItem.quantityReceived
        if (totalReceived > toNum(poItem.quantityOrdered)) {
          throw new Error(`Postavka "${poItem.description}": prevzeta količina (${totalReceived}) presega naročeno (${toNum(poItem.quantityOrdered)})`)
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
            // Atomic increment — prepreči race condition
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
                reason: `Prejem ${po.poNumber}`,
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

      const newStatus = allReceived ? 'received' : anyPartial ? 'partial' : po.status

      const finalPo = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedDate: allReceived ? new Date() : null,
          ...(body.notes ? { notes: body.notes } : {}),
        },
        include: {
          supplier: true,
          items: { include: { inventoryItem: true } },
        },
      })

      // Avtomatsko kreiraj AccountsPayable ob popolnem prejemu blaga
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
            invoiceNumber: po.poNumber,
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

      return { po: finalPo, allReceived, anyPartial }
    })

    // FIX: Ustvari AuditLog za revizijski dnevnik (zunanje transakcijo)
    try {
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'PURCHASE_ORDER_RECEIVED',
        entityType: 'PurchaseOrder',
        entityId: id,
        details: {
          poNumber: po.poNumber,
          supplier: po.supplier?.name || 'Neznan',
          status: result.po.status,
          itemsReceived: body.receivedItems.map((ri: { itemId: string; quantityReceived: number }) => ({
            itemId: ri.itemId,
            quantity: ri.quantityReceived,
          })),
          allReceived: result.allReceived,
        },
      })
    } catch {
      // Audit log napaka ne sme blokirati prejema blaga
    }

    return NextResponse.json({
      success: true,
      message: result.allReceived
        ? 'Blago v celoti prevzeto — zaloga posodobljena, obveznost ustvarjena'
        : 'Blago delno prevzeto — zaloga posodobljena',
      purchaseOrder: deepToNumbers(result.po),
      status: result.po.status,
    }, { status: 200 })
  } catch (error: unknown) {
    // Poslovne napake (npr. količina presega naročeno) naj vrnejo 400
    const message = error instanceof Error ? error.message : 'Napaka'
    if (message.includes('presega') || message.includes('ni najdena') || message.includes('že popolnoma')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return handleApiError(error, 'POST /api/purchase-orders/[id]/receive', 'Napaka pri prevzemu blaga')
  }
}

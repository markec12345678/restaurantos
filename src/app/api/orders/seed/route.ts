
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { getNextCounter } from '@/lib/counters'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, round2, calcVat } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // Zahtevaj admin avtentikacijo za seed
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const menuItems = await db.menuItem.findMany({ take: 10 })
    const tables = await db.table.findMany()

    if (menuItems.length === 0) {
      return NextResponse.json({ error: 'No menu items found. Seed data first.' }, { status: 400 })
    }

    const now = new Date()
    const ordersCreated: Record<string, unknown>[] = []

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const ordersPerDay = Math.floor(Math.random() * 8) + 5
      for (let i = 0; i < ordersPerDay; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - dayOffset)
        date.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60))

        const numItems = Math.floor(Math.random() * 4) + 1
        const selectedItems: { menuItemId: string; price: number; quantity: number; vatRate: number }[] = []
        for (let j = 0; j < numItems; j++) {
          const item = menuItems[Math.floor(Math.random() * menuItems.length)]
          const existing = selectedItems.find(s => s.menuItemId === item.id)
          if (existing) {
            existing.quantity += 1
          } else {
            // FIX BUG 19: Uporabi dejansko DDV stopnjo iz menija, ne hardcoded 10%
            selectedItems.push({
              menuItemId: item.id,
              price: toNum(item.price),
              quantity: Math.floor(Math.random() * 3) + 1,
              vatRate: toNum(item.vatRate),
            })
          }
        }

        // FIX BUG 19: Pravilen izračun DDV po slovenskih stopnjah (22%, 9.5%, 0%)
        let subtotal = 0
        let totalTax = 0
        for (const item of selectedItems) {
          const itemBase = toNum(item.price) * item.quantity
          const itemVat = calcVat(itemBase, item.vatRate)
          subtotal += itemBase
          totalTax += itemVat
        }

        const discount = Math.random() > 0.8 ? Math.floor(subtotal * 0.1) : 0
        const total = subtotal + totalTax - discount

        const type = ['dine-in', 'takeout', 'delivery'][Math.floor(Math.random() * 3)]
        const statuses = ['pending', 'in-progress', 'ready', 'completed']
        const statusIdx = dayOffset === 0 ? Math.floor(Math.random() * 3) : 3
        const status = statuses[statusIdx]

        // FIX BUG 4: Uporabi atomni števec — prepreči race condition
        const orderNumber = await getNextCounter('orderNumber')

        const tableId = type === 'dine-in' && tables.length > 0 ? tables[Math.floor(Math.random() * tables.length)].id : null

        const order = await db.order.create({
          data: {
            orderNumber,
            type,
            status,
            tableId,
            customerName: ['Jože N.', 'Maja S.', 'Miha R.', 'Ana L.', 'Tomaž V.', 'Ema B.'][Math.floor(Math.random() * 6)],
            customerPhone: '',
            subtotal,
            tax: totalTax,
            discount,
            total,
            paymentStatus: status === 'completed' ? 'paid' : (Math.random() > 0.5 ? 'paid' : 'unpaid'),
            paymentMethod: status === 'completed' ? ['cash', 'card', 'mobile'][Math.floor(Math.random() * 3)] : '',
            notes: '',
            inventoryDeducted: status === 'completed',
            createdAt: date,
            orderItems: {
              create: selectedItems.map(item => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                price: toNum(item.price),
                vatRate: toNum(item.vatRate),
                vatAmount: round2(toNum(item.price) * item.quantity * (toNum(item.vatRate) / 100)),
                notes: '',
                status: status === 'completed' ? 'served' : 'pending',
              })),
            },
          },
        })
        ordersCreated.push(order)
      }
    }

    return NextResponse.json({ created: ordersCreated.length })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/orders/seed', 'Napaka pri sejanju podatkov')
  }
}

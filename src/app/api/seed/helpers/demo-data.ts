// =====================================================================
// DEMO PODATKI - Mize, zaposleni, smene, naročila
// =====================================================================

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'

export async function seedDemoData(menuItems: { id: string; price: number; vatRate: number }[]) {
  // ============================================
  // MIZE
  // ============================================
  const tableAreas = ['main', 'main', 'main', 'main', 'main', 'patio', 'patio', 'patio', 'bar', 'bar', 'bar', 'private', 'private', 'main', 'patio']
  const tables = await Promise.all(
    tableAreas.map((area, i) =>
      db.table.create({ data: { number: i + 1, capacity: [2, 4, 4, 6, 8, 4, 4, 2, 2, 2, 2, 8, 10, 4, 6][i], status: 'available', area } })
    )
  )

  // ============================================
  // ZAPOSLENI — PIN hashiran z bcrypt (FIX AUDIT: prej plaintext)
  // ============================================
  const bcrypt = await import('bcryptjs')
  const crypto = await import('crypto')
  const nextauthSecret = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
  const hashPin = async (pin: string) => {
    const hash = await bcrypt.hash(pin, 10)
    const lookup = crypto.createHmac('sha256', nextauthSecret).update(pin).digest('hex')
    return { pin: hash, pinLookup: lookup }
  }

  const emp1Pin = await hashPin('1234')
  const emp2Pin = await hashPin('5678')
  const emp3Pin = await hashPin('9012')
  const emp4Pin = await hashPin('3456')
  const emp5Pin = await hashPin('7890')

  const employees = await Promise.all([
    db.employee.create({ data: { name: 'Ana Novak', email: 'ana@restaurant.com', phone: '040-123-456', role: 'admin', status: 'active', ...emp1Pin } }),
    db.employee.create({ data: { name: 'Marko Horvat', email: 'marko@restaurant.com', phone: '041-234-567', role: 'manager', status: 'active', ...emp2Pin } }),
    db.employee.create({ data: { name: 'Maja Kovač', email: 'maja@restaurant.com', phone: '042-345-678', role: 'staff', status: 'active', ...emp3Pin } }),
    db.employee.create({ data: { name: 'Luka Zupan', email: 'luka@restaurant.com', phone: '043-456-789', role: 'chef', status: 'active', ...emp4Pin } }),
    db.employee.create({ data: { name: 'Eva Krajnc', email: 'eva@restaurant.com', phone: '044-567-890', role: 'staff', status: 'active', ...emp5Pin } }),
    db.employee.create({ data: { name: 'Peter Mlakar', email: 'peter@restaurant.com', phone: '045-678-901', role: 'chef', status: 'inactive', pin: '', pinLookup: '' } }),
  ])

  // ============================================
  // INVENTAR
  // ============================================
  await Promise.all([
    db.inventoryItem.create({ data: { name: 'File lososa', unit: 'kg', quantity: 15, minQuantity: 5, costPerUnit: 18.50, supplier: 'Ocean Fresh', category: 'meat', menuItemId: menuItems[8].id } }),
    db.inventoryItem.create({ data: { name: 'Ribeye zrezek', unit: 'kg', quantity: 20, minQuantity: 8, costPerUnit: 22.00, supplier: 'Prime Meats', category: 'meat', menuItemId: menuItems[9].id } }),
    db.inventoryItem.create({ data: { name: 'Piščančji file', unit: 'kg', quantity: 25, minQuantity: 10, costPerUnit: 8.50, supplier: 'Farm Fresh', category: 'meat', menuItemId: menuItems[10].id } }),
    db.inventoryItem.create({ data: { name: 'Penne testenine', unit: 'kg', quantity: 30, minQuantity: 5, costPerUnit: 3.50, supplier: 'Italian Imports', category: 'dry-goods' } }),
    db.inventoryItem.create({ data: { name: 'Špageti', unit: 'kg', quantity: 25, minQuantity: 5, costPerUnit: 2.80, supplier: 'Italian Imports', category: 'dry-goods' } }),
    db.inventoryItem.create({ data: { name: 'Testo za pico', unit: 'kos', quantity: 40, minQuantity: 15, costPerUnit: 1.50, supplier: 'Hišna priprava', category: 'dry-goods' } }),
    db.inventoryItem.create({ data: { name: 'Mocarela', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 12.00, supplier: 'Dairy Direct', category: 'dairy' } }),
    db.inventoryItem.create({ data: { name: 'Parmezan', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 20.00, supplier: 'Dairy Direct', category: 'dairy' } }),
    db.inventoryItem.create({ data: { name: 'Rimski ohrovt', unit: 'kos', quantity: 12, minQuantity: 5, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce' } }),
    db.inventoryItem.create({ data: { name: 'Paradižnik', unit: 'kg', quantity: 10, minQuantity: 5, costPerUnit: 4.00, supplier: 'Green Valley', category: 'produce' } }),
    db.inventoryItem.create({ data: { name: 'Sveža bazilika', unit: 'šen', quantity: 3, minQuantity: 3, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce' } }),
    db.inventoryItem.create({ data: { name: 'Goveji patty', unit: 'kos', quantity: 50, minQuantity: 20, costPerUnit: 2.50, supplier: 'Prime Meats', category: 'meat' } }),
    db.inventoryItem.create({ data: { name: 'Burger žemlje', unit: 'kos', quantity: 60, minQuantity: 20, costPerUnit: 0.80, supplier: 'Pekarna', category: 'dry-goods' } }),
    db.inventoryItem.create({ data: { name: 'Kavna zrna', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 25.00, supplier: 'Roast Masters', category: 'beverages' } }),
    db.inventoryItem.create({ data: { name: 'Limone', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce' } }),
    db.inventoryItem.create({ data: { name: 'Oljčno olje', unit: 'L', quantity: 10, minQuantity: 3, costPerUnit: 8.00, supplier: 'Italian Imports', category: 'dry-goods' } }),
    db.inventoryItem.create({ data: { name: 'Moka', unit: 'kg', quantity: 20, minQuantity: 5, costPerUnit: 1.50, supplier: 'Pekarna', category: 'dry-goods' } }),
    db.inventoryItem.create({ data: { name: 'Sladkor', unit: 'kg', quantity: 15, minQuantity: 5, costPerUnit: 2.00, supplier: 'Dobavitelj', category: 'dry-goods' } }),
    db.inventoryItem.create({ data: { name: 'Rdeče vino', unit: 'steklenica', quantity: 12, minQuantity: 4, costPerUnit: 15.00, supplier: 'Vinska klet', category: 'beverages' } }),
    db.inventoryItem.create({ data: { name: 'Belo vino', unit: 'steklenica', quantity: 10, minQuantity: 4, costPerUnit: 14.00, supplier: 'Vinska klet', category: 'beverages' } }),
    db.inventoryItem.create({ data: { name: 'Laško pivo keg', unit: 'keg', quantity: 3, minQuantity: 2, costPerUnit: 85.00, supplier: 'Laško Pivovarna', category: 'beverages' } }),
    db.inventoryItem.create({ data: { name: 'Union pivo keg', unit: 'keg', quantity: 2, minQuantity: 2, costPerUnit: 80.00, supplier: 'Pivovarna Union', category: 'beverages' } }),
    db.inventoryItem.create({ data: { name: 'Coca-Cola', unit: 'steklenica', quantity: 48, minQuantity: 12, costPerUnit: 1.20, supplier: 'Coca-Cola CPC', category: 'beverages' } }),
    db.inventoryItem.create({ data: { name: 'Radenska', unit: 'steklenica', quantity: 36, minQuantity: 12, costPerUnit: 0.90, supplier: 'Radenska', category: 'beverages' } }),
    db.inventoryItem.create({ data: { name: 'Krompir', unit: 'kg', quantity: 20, minQuantity: 8, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce' } }),
    db.inventoryItem.create({ data: { name: 'Čebula', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 1.80, supplier: 'Green Valley', category: 'produce' } }),
  ])

  // ============================================
  // IZMENE
  // ============================================
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    for (const emp of employees) {
      if (emp.status === 'inactive') continue
      const isWeekend = date.getDay() === 0 || date.getDay() === 6
      if (isWeekend && emp.role === 'staff') continue
      await db.shift.create({
        data: {
          employeeId: emp.id,
          date,
          startTime: emp.role === 'chef' ? '07:00' : '09:00',
          endTime: emp.role === 'chef' ? '15:00' : '17:00',
          status: i === 0 ? 'completed' : 'scheduled',
        },
      })
    }
  }

  // ============================================
  // PRIMERNI NAROČILA
  // ============================================
  const customerNames = ['Jože N.', 'Maja S.', 'Miha R.', 'Ana L.', 'Tomaž V.', 'Ema B.', 'Aleš K.', 'Lidija M.']
  const orderTypes = ['dine-in', 'takeout', 'delivery']
  const paymentMethods = ['cash', 'card', 'valuto']

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const ordersPerDay = Math.floor(Math.random() * 6) + 5
    for (let i = 0; i < ordersPerDay; i++) {
      const date = new Date()
      date.setDate(date.getDate() - dayOffset)
      date.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60))

      const numItems = Math.floor(Math.random() * 4) + 1
      const selectedItems: { menuItemId: string; price: number; quantity: number; vatRate: number }[] = []
      for (let j = 0; j < numItems; j++) {
        const item = menuItems[Math.floor(Math.random() * menuItems.length)]
        const existing = selectedItems.find(s => s.menuItemId === item.id)
        if (existing) {
          existing.quantity += 1
        } else {
          selectedItems.push({ menuItemId: item.id, price: toNum(item.price), quantity: Math.floor(Math.random() * 2) + 1, vatRate: toNum(item.vatRate ?? 22.0) })
        }
      }

      const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const tax = selectedItems.reduce((sum, item) => sum + item.price * item.quantity * (item.vatRate / 100), 0)
      const discount = Math.random() > 0.8 ? round2(subtotal * 0.1) : 0
      const total = round2(subtotal + tax - discount)

      const type = orderTypes[Math.floor(Math.random() * 3)]
      const statuses = ['pending', 'in-progress', 'ready', 'completed']
      const statusIdx = dayOffset === 0 ? Math.floor(Math.random() * 3) : 3
      const status = statuses[statusIdx]

      const maxOrder = await db.order.findFirst({ orderBy: { orderNumber: 'desc' }, select: { orderNumber: true } })
      const orderNumber = (maxOrder?.orderNumber || 0) + 1

      const tableId = type === 'dine-in' && tables.length > 0 ? tables[Math.floor(Math.random() * tables.length)].id : null

      await db.order.create({
        data: {
          orderNumber,
          type,
          status,
          tableId,
          customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
          customerPhone: '',
          subtotal: round2(subtotal),
          tax: round2(tax),
          discount,
          total: round2(total),
          paymentStatus: status === 'completed' ? 'paid' : (Math.random() > 0.5 ? 'paid' : 'unpaid'),
          paymentMethod: status === 'completed' ? paymentMethods[Math.floor(Math.random() * 3)] : '',
          createdAt: date,
          orderItems: {
            create: selectedItems.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              price: item.price,
              vatRate: item.vatRate ?? 22.0,
              vatAmount: round2(item.price * item.quantity * (item.vatRate / 100)),
              notes: '',
              modifiersJson: '[]',
              status: status === 'completed' ? 'served' : 'pending',
            })),
          },
        },
      })
    }
  }
}

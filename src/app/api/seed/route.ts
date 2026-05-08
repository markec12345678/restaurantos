import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Clean up existing data
    await db.orderItem.deleteMany()
    await db.order.deleteMany()
    await db.shift.deleteMany()
    await db.inventoryItem.deleteMany()
    await db.menuItem.deleteMany()
    await db.category.deleteMany()
    await db.table.deleteMany()
    await db.employee.deleteMany()

    // Kategorije
    const categories = await Promise.all([
      db.category.create({ data: { name: 'Predjedi', icon: '🥗', color: '#10b981', sortOrder: 0 } }),
      db.category.create({ data: { name: 'Glavne jedi', icon: '🥩', color: '#ef4444', sortOrder: 1 } }),
      db.category.create({ data: { name: 'Testenine', icon: '🍝', color: '#f59e0b', sortOrder: 2 } }),
      db.category.create({ data: { name: 'Pica', icon: '🍕', color: '#8b5cf6', sortOrder: 3 } }),
      db.category.create({ data: { name: 'Burgerji', icon: '🍔', color: '#ec4899', sortOrder: 4 } }),
      db.category.create({ data: { name: 'Sladice', icon: '🍰', color: '#06b6d4', sortOrder: 5 } }),
      db.category.create({ data: { name: 'Pijače', icon: '🥤', color: '#3b82f6', sortOrder: 6 } }),
      db.category.create({ data: { name: 'Priloge', icon: '🍟', color: '#84cc16', sortOrder: 7 } }),
    ])

    const [appetizers, mainCourse, pasta, pizza, burgers, desserts, beverages, sides] = categories

    // Artikli jedilnika (s slikami)
    const menuItems = await Promise.all([
      // Predjedi
      db.menuItem.create({ data: { name: 'Cezarjeva solata', description: 'Hrustljav rimski ohrovt s parmezanom in krutoni', price: 9.99, image: '/menu-images/caesar-salad.png', categoryId: appetizers.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Bruschetta', description: 'Opečen kruh s svežim paradižnikom in baziliko', price: 8.49, image: '/menu-images/bruschetta.png', categoryId: appetizers.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Vijolični zavitki', description: 'Hrustljavi zelenjavni zavitki s prelivom', price: 7.99, image: '/menu-images/spring-rolls.png', categoryId: appetizers.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Juha dneva', description: 'Sveže pripravljena dnevna juha', price: 6.99, image: '/menu-images/soup-of-the-day.png', categoryId: appetizers.id, sortOrder: 3 } }),
      // Glavne jedi
      db.menuItem.create({ data: { name: 'Žar losos', description: 'Atlantski losos z omako iz limone in masla', price: 24.99, image: '/menu-images/grilled-salmon.png', categoryId: mainCourse.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Ribeye zrezek', description: '12oz ribeye, pripravljen po vaši želji', price: 32.99, image: '/menu-images/ribeye-steak.png', categoryId: mainCourse.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Piščanec parmezan', description: 'Paniran piščanec s paradižnikovo omako in mocarelo', price: 18.99, image: '/menu-images/chicken-parmesan.png', categoryId: mainCourse.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Janječji kotleti', description: 'Zeliščno obloženi jagnječji kotleti z rožmarinom', price: 28.99, image: '/menu-images/lamb-chops.png', categoryId: mainCourse.id, sortOrder: 3 } }),
      // Testenine
      db.menuItem.create({ data: { name: 'Špageti karbonara', description: 'Klasična karbonara s panceto in jajcem', price: 16.99, image: '/menu-images/spaghetti-carbonara.png', categoryId: pasta.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Fettuccine alfredo', description: 'Kremna alfredo omaka s parmezanom', price: 15.99, image: '/menu-images/fettuccine-alfredo.png', categoryId: pasta.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Penne arrabbiata', description: 'Pikantna paradižnikova omaka s česnom in čilijem', price: 14.49, image: '/menu-images/penne-arrabbiata.png', categoryId: pasta.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Lazanja', description: 'Plasti testenin, mesne omake in sira', price: 17.99, image: '/menu-images/lasagna.png', categoryId: pasta.id, sortOrder: 3 } }),
      // Pica
      db.menuItem.create({ data: { name: 'Margherita', description: 'Sveža mocarela, paradižnik in bazilika', price: 14.99, image: '/menu-images/margherita-pizza.png', categoryId: pizza.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Pepperoni', description: 'Klasična pepperoni z mocarelo', price: 16.99, image: '/menu-images/pepperoni-pizza.png', categoryId: pizza.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'BBQ piščanec', description: 'BBQ omaka, piščanec in rdeča čebula', price: 18.49, image: '/menu-images/bbq-chicken-pizza.png', categoryId: pizza.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Vegetarijanska', description: 'Paprika, gobe, olive in čebula', price: 15.99, image: '/menu-images/vegetarian-pizza.png', categoryId: pizza.id, sortOrder: 3 } }),
      // Burgerji
      db.menuItem.create({ data: { name: 'Klasičen burger', description: 'Goveji patty s solato, paradižnikom in čebulo', price: 13.99, image: '/menu-images/classic-burger.png', categoryId: burgers.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Bacon cheeseburger', description: 'Goveji patty s slanino in cheddarjem', price: 16.49, image: '/menu-images/bacon-cheeseburger.png', categoryId: burgers.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Gobe in švicar', description: 'Goveji patty z dušenimi gobami in švicarskim sirom', price: 15.99, image: '/menu-images/mushroom-swiss-burger.png', categoryId: burgers.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Zelenjavni burger', description: 'Rastlinski patty z avokadom', price: 14.49, image: '/menu-images/veggie-burger.png', categoryId: burgers.id, sortOrder: 3 } }),
      // Sladice
      db.menuItem.create({ data: { name: 'Tiramisu', description: 'Klasična italijanska kavnana sladica', price: 9.99, image: '/menu-images/tiramisu.png', categoryId: desserts.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Čokoladni lava cake', description: 'Topla čokoladna torta s tekočim sredinskim delom', price: 10.99, image: '/menu-images/chocolate-lava-cake.png', categoryId: desserts.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Cheesecake', description: 'New York style cheesecake', price: 8.99, image: '/menu-images/cheesecake.png', categoryId: desserts.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Crème brûlée', description: 'Vaniljeva krema s karameliziranim sladkorjem', price: 9.49, image: '/menu-images/creme-brulee.png', categoryId: desserts.id, sortOrder: 3 } }),
      // Pijače
      db.menuItem.create({ data: { name: 'Sveža limonada', description: 'Domača limonada', price: 4.99, image: '/menu-images/fresh-lemonade.png', categoryId: beverages.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Ledena kava', description: 'Cold brew s smetano', price: 5.49, image: '/menu-images/iced-coffee.png', categoryId: beverages.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Mešana voda', description: 'San Pellegrino', price: 3.49, image: '/menu-images/sparkling-water.png', categoryId: beverages.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Mango smoothie', description: 'Svež mango in jogurt', price: 6.99, image: '/menu-images/mango-smoothie.png', categoryId: beverages.id, sortOrder: 3 } }),
      db.menuItem.create({ data: { name: 'Craft pivo', description: 'Lokalno IPA pivo iz toča', price: 7.99, image: '/menu-images/craft-beer.png', categoryId: beverages.id, sortOrder: 4 } }),
      db.menuItem.create({ data: { name: 'Hišno vino', description: 'Rdeče ali belo, kozarec', price: 9.99, image: '/menu-images/house-wine.png', categoryId: beverages.id, sortOrder: 5 } }),
      // Priloge
      db.menuItem.create({ data: { name: 'Pomfri', description: 'Hrustljavi zlato rumeni pomfri', price: 5.49, image: '/menu-images/french-fries.png', categoryId: sides.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Česnov kruh', description: 'Opečen s česnovim maslom', price: 4.99, image: '/menu-images/garlic-bread.png', categoryId: sides.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Coleslaw', description: 'Kremna solata iz zelja', price: 3.99, image: '/menu-images/coleslaw.png', categoryId: sides.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Čebulni obročki', description: 'V pivskem testu ocvrti čebulni obročki', price: 5.99, image: '/menu-images/onion-rings.png', categoryId: sides.id, sortOrder: 3 } }),
    ])

    // Tables
    const tableAreas = ['main', 'main', 'main', 'main', 'main', 'patio', 'patio', 'patio', 'bar', 'bar', 'bar', 'private', 'private', 'main', 'patio']
    const tables = await Promise.all(
      tableAreas.map((area, i) =>
        db.table.create({ data: { number: i + 1, capacity: [2, 4, 4, 6, 8, 4, 4, 2, 2, 2, 2, 8, 10, 4, 6][i], status: 'available', area } })
      )
    )

    // Employees
    const employees = await Promise.all([
      db.employee.create({ data: { name: 'Maria Rodriguez', email: 'maria@restaurant.com', phone: '555-0101', role: 'admin', status: 'active' } }),
      db.employee.create({ data: { name: 'James Chen', email: 'james@restaurant.com', phone: '555-0102', role: 'manager', status: 'active' } }),
      db.employee.create({ data: { name: 'Sarah Johnson', email: 'sarah@restaurant.com', phone: '555-0103', role: 'staff', status: 'active' } }),
      db.employee.create({ data: { name: 'Ahmed Ali', email: 'ahmed@restaurant.com', phone: '555-0104', role: 'chef', status: 'active' } }),
      db.employee.create({ data: { name: 'Lisa Park', email: 'lisa@restaurant.com', phone: '555-0105', role: 'staff', status: 'active' } }),
      db.employee.create({ data: { name: 'Tom Wilson', email: 'tom@restaurant.com', phone: '555-0106', role: 'chef', status: 'inactive' } }),
    ])

    // Inventory
    await Promise.all([
      db.inventoryItem.create({ data: { name: 'Salmon Fillet', unit: 'kg', quantity: 15, minQuantity: 5, costPerUnit: 18.50, supplier: 'Ocean Fresh', category: 'meat', menuItemId: menuItems[4].id } }),
      db.inventoryItem.create({ data: { name: 'Ribeye Steak', unit: 'kg', quantity: 20, minQuantity: 8, costPerUnit: 22.00, supplier: 'Prime Meats', category: 'meat', menuItemId: menuItems[5].id } }),
      db.inventoryItem.create({ data: { name: 'Chicken Breast', unit: 'kg', quantity: 25, minQuantity: 10, costPerUnit: 8.50, supplier: 'Farm Fresh', category: 'meat', menuItemId: menuItems[6].id } }),
      db.inventoryItem.create({ data: { name: 'Penne Pasta', unit: 'kg', quantity: 30, minQuantity: 5, costPerUnit: 3.50, supplier: 'Italian Imports', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Spaghetti', unit: 'kg', quantity: 25, minQuantity: 5, costPerUnit: 2.80, supplier: 'Italian Imports', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Pizza Dough', unit: 'pcs', quantity: 40, minQuantity: 15, costPerUnit: 1.50, supplier: 'In-house', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Mozzarella', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 12.00, supplier: 'Dairy Direct', category: 'dairy' } }),
      db.inventoryItem.create({ data: { name: 'Parmesan', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 20.00, supplier: 'Dairy Direct', category: 'dairy' } }),
      db.inventoryItem.create({ data: { name: 'Romaine Lettuce', unit: 'pcs', quantity: 12, minQuantity: 5, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Tomatoes', unit: 'kg', quantity: 10, minQuantity: 5, costPerUnit: 4.00, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Fresh Basil', unit: 'bunch', quantity: 3, minQuantity: 3, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Beef Patties', unit: 'pcs', quantity: 50, minQuantity: 20, costPerUnit: 2.50, supplier: 'Prime Meats', category: 'meat' } }),
      db.inventoryItem.create({ data: { name: 'Burger Buns', unit: 'pcs', quantity: 60, minQuantity: 20, costPerUnit: 0.80, supplier: 'Bakery Co', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Coffee Beans', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 25.00, supplier: 'Roast Masters', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Lemons', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Olive Oil', unit: 'L', quantity: 10, minQuantity: 3, costPerUnit: 8.00, supplier: 'Italian Imports', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Flour', unit: 'kg', quantity: 20, minQuantity: 5, costPerUnit: 1.50, supplier: 'Bakery Co', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Sugar', unit: 'kg', quantity: 15, minQuantity: 5, costPerUnit: 2.00, supplier: 'General Supply', category: 'dry-goods' } }),
      db.inventoryItem.create({ data: { name: 'Red Wine', unit: 'bottle', quantity: 12, minQuantity: 4, costPerUnit: 15.00, supplier: 'Wine Merchants', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Beer Kegs', unit: 'keg', quantity: 3, minQuantity: 2, costPerUnit: 85.00, supplier: 'Craft Brewery', category: 'beverages' } }),
      db.inventoryItem.create({ data: { name: 'Potatoes', unit: 'kg', quantity: 20, minQuantity: 8, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce' } }),
      db.inventoryItem.create({ data: { name: 'Onions', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 1.80, supplier: 'Green Valley', category: 'produce' } }),
    ])

    // Shifts for current week
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

    // Sample orders
    const customerNames = ['John D.', 'Jane S.', 'Mike R.', 'Sarah L.', 'Tom W.', 'Emma B.', 'Alex K.', 'Lisa M.']
    const orderTypes = ['dine-in', 'takeaway', 'delivery']
    const paymentMethods = ['cash', 'card', 'upi']

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const ordersPerDay = Math.floor(Math.random() * 6) + 5
      for (let i = 0; i < ordersPerDay; i++) {
        const date = new Date()
        date.setDate(date.getDate() - dayOffset)
        date.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60))

        const numItems = Math.floor(Math.random() * 4) + 1
        const selectedItems: { menuItemId: string; price: number; quantity: number }[] = []
        for (let j = 0; j < numItems; j++) {
          const item = menuItems[Math.floor(Math.random() * menuItems.length)]
          const existing = selectedItems.find(s => s.menuItemId === item.id)
          if (existing) {
            existing.quantity += 1
          } else {
            selectedItems.push({ menuItemId: item.id, price: item.price, quantity: Math.floor(Math.random() * 2) + 1 })
          }
        }

        const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
        const tax = subtotal * 0.1
        const discount = Math.random() > 0.8 ? Math.round(subtotal * 0.1 * 100) / 100 : 0
        const total = subtotal + tax - discount

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
            subtotal: Math.round(subtotal * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            discount,
            total: Math.round(total * 100) / 100,
            paymentStatus: status === 'completed' ? 'paid' : (Math.random() > 0.5 ? 'paid' : 'unpaid'),
            paymentMethod: status === 'completed' ? paymentMethods[Math.floor(Math.random() * 3)] : '',
            createdAt: date,
            orderItems: {
              create: selectedItems.map(item => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                price: item.price,
                notes: '',
                status: status === 'completed' ? 'served' : 'pending',
              })),
            },
          },
        })
      }
    }

    return NextResponse.json({ success: true, message: 'Podatki so bili uspešno naloženi' })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Napaka pri nalaganju podatkov' }, { status: 500 })
  }
}

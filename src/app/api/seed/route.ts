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

    // Categories
    const categories = await Promise.all([
      db.category.create({ data: { name: 'Appetizers', icon: '🥗', color: '#10b981', sortOrder: 0 } }),
      db.category.create({ data: { name: 'Main Course', icon: '🥩', color: '#ef4444', sortOrder: 1 } }),
      db.category.create({ data: { name: 'Pasta', icon: '🍝', color: '#f59e0b', sortOrder: 2 } }),
      db.category.create({ data: { name: 'Pizza', icon: '🍕', color: '#8b5cf6', sortOrder: 3 } }),
      db.category.create({ data: { name: 'Burgers', icon: '🍔', color: '#ec4899', sortOrder: 4 } }),
      db.category.create({ data: { name: 'Desserts', icon: '🍰', color: '#06b6d4', sortOrder: 5 } }),
      db.category.create({ data: { name: 'Beverages', icon: '🥤', color: '#3b82f6', sortOrder: 6 } }),
      db.category.create({ data: { name: 'Sides', icon: '🍟', color: '#84cc16', sortOrder: 7 } }),
    ])

    const [appetizers, mainCourse, pasta, pizza, burgers, desserts, beverages, sides] = categories

    // Menu Items (with images)
    const menuItems = await Promise.all([
      // Appetizers
      db.menuItem.create({ data: { name: 'Caesar Salad', description: 'Crisp romaine with parmesan and croutons', price: 9.99, image: '/menu-images/caesar-salad.png', categoryId: appetizers.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Bruschetta', description: 'Toasted bread with fresh tomato and basil', price: 8.49, image: '/menu-images/bruschetta.png', categoryId: appetizers.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Spring Rolls', description: 'Crispy vegetable spring rolls with dip', price: 7.99, image: '/menu-images/spring-rolls.png', categoryId: appetizers.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Soup of the Day', description: 'Freshly made daily soup', price: 6.99, image: '/menu-images/soup-of-the-day.png', categoryId: appetizers.id, sortOrder: 3 } }),
      // Main Course
      db.menuItem.create({ data: { name: 'Grilled Salmon', description: 'Atlantic salmon with lemon butter sauce', price: 24.99, image: '/menu-images/grilled-salmon.png', categoryId: mainCourse.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Ribeye Steak', description: '12oz ribeye cooked to your preference', price: 32.99, image: '/menu-images/ribeye-steak.png', categoryId: mainCourse.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Chicken Parmesan', description: 'Breaded chicken with marinara and mozzarella', price: 18.99, image: '/menu-images/chicken-parmesan.png', categoryId: mainCourse.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Lamb Chops', description: 'Herb-crusted lamb chops with rosemary', price: 28.99, image: '/menu-images/lamb-chops.png', categoryId: mainCourse.id, sortOrder: 3 } }),
      // Pasta
      db.menuItem.create({ data: { name: 'Spaghetti Carbonara', description: 'Classic carbonara with pancetta and egg', price: 16.99, image: '/menu-images/spaghetti-carbonara.png', categoryId: pasta.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Fettuccine Alfredo', description: 'Creamy alfredo sauce with parmesan', price: 15.99, image: '/menu-images/fettuccine-alfredo.png', categoryId: pasta.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Penne Arrabbiata', description: 'Spicy tomato sauce with garlic and chili', price: 14.49, image: '/menu-images/penne-arrabbiata.png', categoryId: pasta.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Lasagna', description: 'Layers of pasta, meat sauce, and cheese', price: 17.99, image: '/menu-images/lasagna.png', categoryId: pasta.id, sortOrder: 3 } }),
      // Pizza
      db.menuItem.create({ data: { name: 'Margherita', description: 'Fresh mozzarella, tomato, and basil', price: 14.99, image: '/menu-images/margherita-pizza.png', categoryId: pizza.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Pepperoni', description: 'Classic pepperoni with mozzarella', price: 16.99, image: '/menu-images/pepperoni-pizza.png', categoryId: pizza.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'BBQ Chicken', description: 'BBQ sauce, chicken, and red onion', price: 18.49, image: '/menu-images/bbq-chicken-pizza.png', categoryId: pizza.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Vegetarian', description: 'Bell peppers, mushrooms, olives, and onion', price: 15.99, image: '/menu-images/vegetarian-pizza.png', categoryId: pizza.id, sortOrder: 3 } }),
      // Burgers
      db.menuItem.create({ data: { name: 'Classic Burger', description: 'Beef patty with lettuce, tomato, and onion', price: 13.99, image: '/menu-images/classic-burger.png', categoryId: burgers.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Bacon Cheeseburger', description: 'Beef patty with bacon and cheddar', price: 16.49, image: '/menu-images/bacon-cheeseburger.png', categoryId: burgers.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Mushroom Swiss', description: 'Beef patty with sautéed mushrooms and Swiss', price: 15.99, image: '/menu-images/mushroom-swiss-burger.png', categoryId: burgers.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Veggie Burger', description: 'Plant-based patty with avocado', price: 14.49, image: '/menu-images/veggie-burger.png', categoryId: burgers.id, sortOrder: 3 } }),
      // Desserts
      db.menuItem.create({ data: { name: 'Tiramisu', description: 'Classic Italian coffee dessert', price: 9.99, image: '/menu-images/tiramisu.png', categoryId: desserts.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Chocolate Lava Cake', description: 'Warm chocolate cake with molten center', price: 10.99, image: '/menu-images/chocolate-lava-cake.png', categoryId: desserts.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Cheesecake', description: 'New York style cheesecake', price: 8.99, image: '/menu-images/cheesecake.png', categoryId: desserts.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Crème Brûlée', description: 'Vanilla custard with caramelized sugar', price: 9.49, image: '/menu-images/creme-brulee.png', categoryId: desserts.id, sortOrder: 3 } }),
      // Beverages
      db.menuItem.create({ data: { name: 'Fresh Lemonade', description: 'House-made lemonade', price: 4.99, image: '/menu-images/fresh-lemonade.png', categoryId: beverages.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Iced Coffee', description: 'Cold brew with cream', price: 5.49, image: '/menu-images/iced-coffee.png', categoryId: beverages.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Sparkling Water', description: 'San Pellegrino', price: 3.49, image: '/menu-images/sparkling-water.png', categoryId: beverages.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Mango Smoothie', description: 'Fresh mango and yogurt blend', price: 6.99, image: '/menu-images/mango-smoothie.png', categoryId: beverages.id, sortOrder: 3 } }),
      db.menuItem.create({ data: { name: 'Craft Beer', description: 'Local IPA on tap', price: 7.99, image: '/menu-images/craft-beer.png', categoryId: beverages.id, sortOrder: 4 } }),
      db.menuItem.create({ data: { name: 'House Wine', description: 'Red or white, by the glass', price: 9.99, image: '/menu-images/house-wine.png', categoryId: beverages.id, sortOrder: 5 } }),
      // Sides
      db.menuItem.create({ data: { name: 'French Fries', description: 'Crispy golden fries', price: 5.49, image: '/menu-images/french-fries.png', categoryId: sides.id, sortOrder: 0 } }),
      db.menuItem.create({ data: { name: 'Garlic Bread', description: 'Toasted with garlic butter', price: 4.99, image: '/menu-images/garlic-bread.png', categoryId: sides.id, sortOrder: 1 } }),
      db.menuItem.create({ data: { name: 'Coleslaw', description: 'Creamy coleslaw', price: 3.99, image: '/menu-images/coleslaw.png', categoryId: sides.id, sortOrder: 2 } }),
      db.menuItem.create({ data: { name: 'Onion Rings', description: 'Beer-battered onion rings', price: 5.99, image: '/menu-images/onion-rings.png', categoryId: sides.id, sortOrder: 3 } }),
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

    return NextResponse.json({ success: true, message: 'Database seeded successfully' })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 })
  }
}

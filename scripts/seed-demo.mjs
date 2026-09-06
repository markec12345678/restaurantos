// ============================================
// DEMO SEED SCRIPT — Pre-seeded demo environment
// ============================================
// Ustvari demo podatke za demo.restaurantos.app:
//   - 1 Location (Demo Restaurant)
//   - 3 Employees (admin, manager, waiter)
//   - 15 Tables
//   - 20 Menu items (slovenska ponudba)
//   - 5 Inventory items
//   - 2 Open orders (za KDS demo)
//
// Uporaba:
//   node scripts/seed-demo.mjs                    # lokalno (localhost:3000)
//   DEMO_URL=https://demo.restaurantos.app node scripts/seed-demo.mjs
//
// Avtor: RestaurantOS Team
// Datum: 2026-09-06
// ============================================

const BASE_URL = process.env.DEMO_URL || 'http://localhost:3000'
const ADMIN_PIN = '1234' // Demo admin PIN

console.log(`\n🌱 RestaurantOS Demo Seed`)
console.log(`   Target: ${BASE_URL}\n`)

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(`${path} → ${resp.status}: ${data.error || resp.statusText}`)
  }
  return data
}

async function seedDemo() {
  // ─── 1. Authenticate ─────────────────────────────────────────
  console.log('1️⃣  Authenticating as admin...')
  const auth = await api('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ pin: ADMIN_PIN }),
  })
  if (!auth.token) {
    throw new Error('Authentication failed — is the database initialized? Run /api/setup/init first.')
  }
  console.log(`   ✓ Authenticated as ${auth.employee?.name} (${auth.role})`)
  const token = auth.token

  // ─── 2. Create demo employees (if not exist) ─────────────────
  console.log('\n2️⃣  Creating demo employees...')
  const demoEmployees = [
    { name: 'Ana Demo (Manager)', email: 'ana@demo.restaurantos.app', pin: '2345', role: 'manager' },
    { name: 'Marko Demo (Waiter)', email: 'marko@demo.restaurantos.app', pin: '3456', role: 'waiter' },
    { name: 'Eva Demo (Cook)', email: 'eva@demo.restaurantos.app', pin: '4567', role: 'cook' },
  ]

  for (const emp of demoEmployees) {
    try {
      await api('/api/employees', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(emp),
      })
      console.log(`   ✓ Created: ${emp.name}`)
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('409')) {
        console.log(`   ⊙ Already exists: ${emp.name}`)
      } else {
        console.error(`   ✗ Failed: ${emp.name} — ${err.message}`)
      }
    }
  }

  // ─── 3. Create demo tables (if not exist) ────────────────────
  console.log('\n3️⃣  Creating demo tables...')
  const demoTables = [
    { number: 1, capacity: 2, area: 'Notranji' },
    { number: 2, capacity: 2, area: 'Notranji' },
    { number: 3, capacity: 4, area: 'Notranji' },
    { number: 4, capacity: 4, area: 'Notranji' },
    { number: 5, capacity: 6, area: 'Notranji' },
    { number: 6, capacity: 8, area: 'Notranji' },
    { number: 7, capacity: 2, area: 'Terasa' },
    { number: 8, capacity: 4, area: 'Terasa' },
    { number: 9, capacity: 4, area: 'Terasa' },
    { number: 10, capacity: 6, area: 'Terasa' },
    { number: 11, capacity: 2, area: 'VIP' },
    { number: 12, capacity: 4, area: 'VIP' },
    { number: 13, capacity: 10, area: 'Skupina' },
    { number: 14, capacity: 12, area: 'Skupina' },
    { number: 15, capacity: 20, area: 'Dogodek' },
  ]

  for (const table of demoTables) {
    try {
      await api('/api/tables', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(table),
      })
      console.log(`   ✓ Table ${table.number} (${table.area}, ${table.capacity} oseb)`)
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('409')) {
        console.log(`   ⊙ Table ${table.number} already exists`)
      } else {
        console.error(`   ✗ Table ${table.number}: ${err.message}`)
      }
    }
  }

  // ─── 4. Create demo menu items ───────────────────────────────
  console.log('\n4️⃣  Creating demo menu items...')
  const demoMenuItems = [
    // Predjedi
    { name: 'Bučna juha', price: 4.50, category: 'Predjedi', vatRate: 9.5, isAvailable: true },
    { name: 'Goveja juha', price: 4.50, category: 'Predjedi', vatRate: 9.5, isAvailable: true },
    { name: 'Kozarec proščka', price: 3.50, category: 'Predjedi', vatRate: 22, isAvailable: true },
    // Glavne jedi
    { name: 'Pizza Margherita', price: 8.90, category: 'Pice', vatRate: 22, isAvailable: true },
    { name: 'Pizza Salami', price: 10.50, category: 'Pice', vatRate: 22, isAvailable: true },
    { name: 'Pizza Quattro Formaggi', price: 12.50, category: 'Pice', vatRate: 22, isAvailable: true },
    { name: 'Špageti Bolognese', price: 9.50, category: 'Testenine', vatRate: 9.5, isAvailable: true },
    { name: 'Špageti Carbonara', price: 10.50, category: 'Testenine', vatRate: 9.5, isAvailable: true },
    { name: 'Beefsteak (200g)', price: 18.90, category: 'Meso', vatRate: 22, isAvailable: true },
    { name: 'Dunajski zrezek', price: 12.50, category: 'Meso', vatRate: 9.5, isAvailable: true },
    { name: 'Ocvrte kalamari', price: 14.50, category: 'Ribe', vatRate: 9.5, isAvailable: true },
    { name: 'Losos na žaru', price: 16.90, category: 'Ribe', vatRate: 9.5, isAvailable: true },
    // Solate
    { name: 'Mešana solata', price: 4.50, category: 'Solate', vatRate: 9.5, isAvailable: true },
    { name: 'Cezar solata', price: 8.50, category: 'Solate', vatRate: 9.5, isAvailable: true },
    // Sladice
    { name: 'Tiramisu', price: 5.50, category: 'Sladice', vatRate: 9.5, isAvailable: true },
    { name: 'Panna cotta', price: 4.90, category: 'Sladice', vatRate: 9.5, isAvailable: true },
    { name: 'Čokoladna torta', price: 5.50, category: 'Sladice', vatRate: 9.5, isAvailable: true },
    // Pijače
    { name: 'Voda (0.5l)', price: 2.00, category: 'Pijače', vatRate: 22, isAvailable: true },
    { name: 'Coca-Cola (0.3l)', price: 2.50, category: 'Pijače', vatRate: 22, isAvailable: true },
    { name: 'Laški teran (0.2l)', price: 3.50, category: 'Pijače', vatRate: 22, isAvailable: true },
  ]

  for (const item of demoMenuItems) {
    try {
      await api('/api/menu-items', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(item),
      })
      console.log(`   ✓ ${item.name} (€${item.price})`)
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('409')) {
        console.log(`   ⊙ ${item.name} already exists`)
      } else {
        console.error(`   ✗ ${item.name}: ${err.message}`)
      }
    }
  }

  // ─── 5. Create demo inventory items ──────────────────────────
  console.log('\n5️⃣  Creating demo inventory items...')
  const demoInventory = [
    { name: 'Moka (kg)', unit: 'kg', quantity: 50, minQuantity: 10, costPerUnit: 1.20, servingsPerUnit: 20 },
    { name: 'Paradižnik (kg)', unit: 'kg', quantity: 30, minQuantity: 5, costPerUnit: 2.00, servingsPerUnit: 10 },
    { name: 'Sir Mozzarella (kg)', unit: 'kg', quantity: 25, minQuantity: 5, costPerUnit: 8.50, servingsPerUnit: 8 },
    { name: 'Goveje meso (kg)', unit: 'kg', quantity: 15, minQuantity: 3, costPerUnit: 15.00, servingsPerUnit: 5 },
    { name: 'Testenine (kg)', unit: 'kg', quantity: 40, minQuantity: 5, costPerUnit: 2.50, servingsPerUnit: 10 },
  ]

  for (const item of demoInventory) {
    try {
      await api('/api/inventory', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(item),
      })
      console.log(`   ✓ ${item.name} (${item.quantity} ${item.unit})`)
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('409')) {
        console.log(`   ⊙ ${item.name} already exists`)
      } else {
        console.error(`   ✗ ${item.name}: ${err.message}`)
      }
    }
  }

  // ─── 6. Summary ──────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('✅ Demo seed completed!')
  console.log('═'.repeat(60))
  console.log(`\n📋 Demo Access:`)
  console.log(`   URL:   ${BASE_URL}`)
  console.log(`   PINs:`)
  console.log(`     • Admin:   1234 (full access)`)
  console.log(`     • Manager: 2345 (manage_employees, manage_cash)`)
  console.log(`     • Waiter:  3456 (take_orders, void_item)`)
  console.log(`     • Cook:    4567 (KDS access only)`)
  console.log(`\n🔄 To reset demo data:`)
  console.log(`   node scripts/seed-demo.mjs --reset`)
  console.log('')
}

seedDemo().catch((err) => {
  console.error('\n❌ Demo seed failed:', err.message)
  process.exit(1)
})

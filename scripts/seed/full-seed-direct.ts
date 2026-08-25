// ============================================
// DIRECT SEED: 437 artiklov z bildanjami, alergeni, slikami
// Zaženi: npx tsx scripts/seed/full-seed-direct.ts
// ============================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Začenjam full seed (437 artiklov)...\n')

  // 1. Počisti obstoječe podatke
  console.log('1️⃣  Čistim obstoječe podatke...')
  await prisma.menuItemModifierGroup.deleteMany()
  await prisma.menuItem.deleteMany()
  await prisma.modifier.deleteMany()
  await prisma.modifierGroup.deleteMany()
  await prisma.category.deleteMany()
  await prisma.menu.deleteMany()
  await prisma.diningOption.deleteMany()
  await prisma.voidReason.deleteMany()
  await prisma.noSaleReason.deleteMany()
  await prisma.discount.deleteMany()
  await prisma.taxRate.deleteMany()
  console.log('   ✅ Očiščeno\n')

  // 2. Ustvari meni
  console.log('2️⃣  Ustvarjam meni...')
  const menu = await prisma.menu.create({
    data: {
      name: 'Glavni meni',
      icon: '📋',
      color: '#f59e0b',
      sortOrder: 0,
      isActive: true,
    },
  })
  console.log(`   ✅ Meni: ${menu.name}\n`)

  // 3. Ustvari kategorije
  console.log('3️⃣  Ustvarjam kategorije...')
  const categories = [
    { name: 'Hladne predjedi', icon: '🥗', color: '#22c55e' },
    { name: 'Tople predjedi', icon: '🍽️', color: '#f97316' },
    { name: 'Juhe', icon: '🍲', color: '#a855f7' },
    { name: 'Solate', icon: '🥬', color: '#22c55e' },
    { name: 'Pizze', icon: '🍕', color: '#ef4444' },
    { name: 'Burgerji', icon: '🍔', color: '#f59e0b' },
    { name: 'Kalamari', icon: '🦑', color: '#3b82f6' },
    { name: 'Ribje jedi', icon: '🐟', color: '#06b6d4' },
    { name: 'Testenine in njoki', icon: '🍝', color: '#f97316' },
    { name: 'Rizote', icon: '🍚', color: '#eab308' },
    { name: 'Glavne jedi', icon: '🥩', color: '#ef4444' },
    { name: 'Vegetarijanske jedi', icon: '🥦', color: '#22c55e' },
    { name: 'Malice', icon: '🍱', color: '#f59e0b' },
    { name: 'Priloge', icon: '🍟', color: '#f97316' },
    { name: 'Omake', icon: '🥫', color: '#78716c' },
    { name: 'Otroške jedi', icon: '🧒', color: '#3b82f6' },
    { name: 'Palačinke', icon: '🥞', color: '#ec4899' },
    { name: 'Sladice', icon: '🍰', color: '#ec4899' },
    { name: 'Topli napitki', icon: '☕', color: '#92400e' },
    { name: 'Brezalkoholne pijače', icon: '🥤', color: '#3b82f6' },
    { name: 'Vode', icon: '💧', color: '#06b6d4' },
    { name: 'Sokovi', icon: '🧃', color: '#f59e0b' },
    { name: 'Naravni sokovi', icon: '🍹', color: '#f59e0b' },
    { name: 'Točeno pivo', icon: '🍺', color: '#f59e0b' },
    { name: 'Pivo', icon: '🍻', color: '#f59e0b' },
    { name: 'Craft piva', icon: '🍺', color: '#8b5cf6' },
    { name: 'Brezalk. pivo', icon: '🍺', color: '#3b82f6' },
    { name: 'Penine', icon: '🥂', color: '#f59e0b' },
    { name: 'Bela vina', icon: '🍷', color: '#f59e0b' },
    { name: 'Rdeča vina', icon: '🍷', color: '#dc2626' },
    { name: 'Rosé vino', icon: '🍷', color: '#ec4899' },
    { name: 'Tuja vina', icon: '🍷', color: '#7c2d12' },
    { name: 'Likersko vino', icon: '🍷', color: '#9333ea' },
    { name: 'Mešane pijače', icon: '🍸', color: '#8b5cf6' },
    { name: 'Gin', icon: '🍸', color: '#3b82f6' },
    { name: 'Viski', icon: '🥃', color: '#92400e' },
    { name: 'Destilati', icon: '🥃', color: '#78716c' },
    { name: 'Likerji', icon: '🍸', color: '#ec4899' },
    { name: 'Grenčice', icon: '🥃', color: '#16a34a' },
  ]

  const catMap: Record<string, { id: string }> = {}
  for (let i = 0; i < categories.length; i++) {
    const cat = await prisma.category.create({
      data: {
        name: categories[i].name,
        icon: categories[i].icon,
        color: categories[i].color,
        sortOrder: i,
        menuId: menu.id,
      },
    })
    const key = categories[i].name
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[čć]/g, 'c').replace(/[š]/g, 's').replace(/[ž]/g, 'z')
      .replace(/đ/g, 'd')
    catMap[key] = { id: cat.id }
  }
  console.log(`   ✅ ${categories.length} kategorij\n`)

  // 4. Ustvari dining options
  console.log('4️⃣  Ustvarjam dining options...')
  const diningOptions = [
    { name: 'Na mestu', type: 'dine-in', isActive: true, sortOrder: 0, prepTimeMinutes: 15 },
    { name: 'Za s seboj', type: 'takeout', isActive: true, sortOrder: 1, prepTimeMinutes: 10 },
    { name: 'Dostava', type: 'delivery', isActive: true, sortOrder: 2, prepTimeMinutes: 30 },
  ]
  for (const d of diningOptions) {
    await prisma.diningOption.create({ data: d })
  }
  console.log(`   ✅ ${diningOptions.length} dining options\n`)

  // 5. Ustvari void reasons
  console.log('5️⃣  Ustvarjam void reasons...')
  const voidReasons = [
    { name: 'Napaka natakarja', isActive: true, sortOrder: 0 },
    { name: 'Kuhinja zgrešila', isActive: true, sortOrder: 1 },
    { name: 'Stranka zamenjala mnenje', isActive: true, sortOrder: 2 },
    { name: 'Alergija', isActive: true, sortOrder: 3 },
    { name: 'Hrana hladna', isActive: true, sortOrder: 4 },
    { name: 'Predolgo čakanje', isActive: true, sortOrder: 5 },
  ]
  for (const v of voidReasons) {
    await prisma.voidReason.create({ data: v })
  }
  console.log(`   ✅ ${voidReasons.length} void reasons\n`)

  // 6. Ustvari no-sale reasons (za lastna poraba itd.)
  console.log('6️⃣  Ustvarjam no-sale reasons...')
  const noSaleReasons = [
    { name: 'Mali dvig', isActive: true, sortOrder: 0 },
    { name: 'Vračilo dobavitelju', isActive: true, sortOrder: 1 },
    { name: 'Izplačilo napitnine', isActive: true, sortOrder: 2 },
    { name: 'Zamenjava', isActive: true, sortOrder: 3 },
    { name: 'Lastna poraba', isActive: true, sortOrder: 4 },
    { name: 'Kuhinjska poraba', isActive: true, sortOrder: 5 },
    { name: 'Pokvarjeno', isActive: true, sortOrder: 6 },
  ]
  for (const n of noSaleReasons) {
    await prisma.noSaleReason.create({ data: n })
  }
  console.log(`   ✅ ${noSaleReasons.length} no-sale reasons\n`)

  // 7. Ustvari popuste (discounts)
  console.log('7️⃣  Ustvarjam popuste...')
  const discounts = [
    { name: 'Lastna poraba (100%)', type: 'percentage', amount: 100, appliesTo: 'item', triggerType: 'manual', isActive: true, sortOrder: 0 },
    { name: 'Zaposleniški popust (30%)', type: 'percentage', amount: 30, appliesTo: 'check', triggerType: 'manual', isActive: true, sortOrder: 1 },
    { name: 'Happy Hour (-20%)', type: 'percentage', amount: 20, appliesTo: 'check', triggerType: 'auto', isActive: true, sortOrder: 2 },
    { name: 'Ročni popust 10%', type: 'percentage', amount: 10, appliesTo: 'item', triggerType: 'manual', isActive: true, sortOrder: 3 },
    { name: 'Ročni popust 15%', type: 'percentage', amount: 15, appliesTo: 'item', triggerType: 'manual', isActive: true, sortOrder: 4 },
    { name: 'Ročni popust 20%', type: 'percentage', amount: 20, appliesTo: 'item', triggerType: 'manual', isActive: true, sortOrder: 5 },
    { name: 'Ročni popust 50%', type: 'percentage', amount: 50, appliesTo: 'item', triggerType: 'manual', isActive: true, sortOrder: 6 },
    { name: 'Domači rojstni dan (100%)', type: 'percentage', amount: 100, appliesTo: 'item', triggerType: 'manual', isActive: true, sortOrder: 7 },
    { name: 'Kompenzacija (fiksni €5)', type: 'fixed_amount', amount: 5, appliesTo: 'check', triggerType: 'manual', isActive: true, sortOrder: 8 },
    { name: 'Promo koda -10%', type: 'percentage', amount: 10, appliesTo: 'check', triggerType: 'promo_code', promoCode: 'WELCOME10', isActive: true, sortOrder: 9 },
  ]
  for (const d of discounts) {
    await prisma.discount.create({ data: d })
  }
  console.log(`   ✅ ${discounts.length} popustov\n`)

  // 8. Ustvari tax rates
  console.log('8️⃣  Ustvarjam davčne stopnje...')
  const taxRates = [
    { code: 'S', name: 'Standardna stopnja (22%)', rate: 22.0 },
    { code: 'R', name: 'Nižja stopnja (9.5%)', rate: 9.5 },
    { code: 'Z', name: 'Nična stopnja (0%)', rate: 0 },
  ]
  for (const t of taxRates) {
    await prisma.taxRate.create({ data: t })
  }
  console.log(`   ✅ ${taxRates.length} davčnih stopenj\n`)

  // 9. Import vseh artiklov iz seed helperjev
  console.log('9️⃣  Uvažam artikle iz seed helperjev...')
  
  // Uporabimo dinamični import za seed helperje
  const { getMenuItemsData } = await import('../../src/app/api/seed/helpers/menu-items')
  const { seedModifierGroups } = await import('../../src/app/api/seed/helpers/seed-modifiers')
  const { seedMenusAndCategories } = await import('../../src/app/api/seed/helpers/seed-structure')

  // Ponastavimo kategorije iz seed helperjev
  await prisma.category.deleteMany()
  const { cats } = await seedMenusAndCategories(prisma)
  const mods = await seedModifierGroups(prisma)
  
  const menuItemsData = getMenuItemsData(cats, mods)
  console.log(`   📋 Najdeno ${menuItemsData.length} artiklov za uvoz\n`)

  let imported = 0
  let skipped = 0
  for (const itemData of menuItemsData) {
    try {
      const { modifierGroupIds, ...itemFields } = itemData
      const item = await prisma.menuItem.create({ data: itemFields })
      
      // Poveži modifikatorje
      if (modifierGroupIds && modifierGroupIds.length > 0) {
        for (let i = 0; i < modifierGroupIds.length; i++) {
          await prisma.menuItemModifierGroup.create({
            data: { menuItemId: item.id, modifierGroupId: modifierGroupIds[i], sortOrder: i }
          })
        }
      }
      
      imported++
      if (imported % 50 === 0) {
        console.log(`   📦 Uvoženih ${imported}/${menuItemsData.length}...`)
      }
    } catch (err) {
      skipped++
      console.log(`   ⚠️  Preskočen: ${itemData.name} — ${err instanceof Error ? err.message.slice(0, 80) : err}`)
    }
  }

  console.log(`\n   ✅ Uvoženih: ${imported}`)
  console.log(`   ⚠️  Preskočenih: ${skipped}\n`)

  // 10. Rezultat
  const totalItems = await prisma.menuItem.count()
  const totalCategories = await prisma.category.count()
  const totalModifiers = await prisma.modifierGroup.count()
  const totalDiscounts = await prisma.discount.count()
  const itemsWithImage = await prisma.menuItem.count({ where: { NOT: { image: '' } } })
  const itemsWithAllergens = await prisma.menuItem.count({ where: { NOT: { allergens: '' } } })

  console.log('═══════════════════════════════════════════')
  console.log('  ✅ SEED ZAKLJUČEN')
  console.log('═══════════════════════════════════════════')
  console.log(`  📊 Meni artikli:     ${totalItems}`)
  console.log(`  📂 Kategorije:       ${totalCategories}`)
  console.log(`  🔧 Modifikatorji:    ${totalModifiers}`)
  console.log(`  💰 Popusti:          ${totalDiscounts}`)
  console.log(`  🖼️  Z sliko:          ${itemsWithImage}`)
  console.log(`  ⚠️  Z alergeni:       ${itemsWithAllergens}`)
  console.log(`  📋 Brez slike:       ${totalItems - itemsWithImage}`)
  console.log('═══════════════════════════════════════════')
  console.log('\n📋 Pripravljeni popusti:')
  const allDiscounts = await prisma.discount.findMany()
  for (const d of allDiscounts) {
    console.log(`  • ${d.name} (${d.type}: ${d.amount}%) — ${d.appliesTo}`)
  }
  console.log('\n📋 Davčne stopnje:')
  const allTaxes = await prisma.taxRate.findMany()
  for (const t of allTaxes) {
    console.log(`  • ${t.code}: ${t.name} (${t.rate}%)`)
  }
  console.log('\n📋 No-sale reasons (za lastna poraba):')
  const allNoSale = await prisma.noSaleReason.findMany()
  for (const n of allNoSale) {
    console.log(`  • ${n.name}`)
  }
  console.log('')
}

async function pridaVoidReasons() {
  // placeholder — void reasons created later
}

main()
  .catch((e) => {
    console.error('❌ Napaka:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

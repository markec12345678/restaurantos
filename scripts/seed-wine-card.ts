/**
 * Seed script for Wine Card & Drinks Price List
 * Terme Olimia - Comprehensive Slovenian drinks menu
 * 
 * Usage: npx tsx scripts/seed-wine-card.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🍷 Seeding Wine Card & Drinks Price List...')

  // ============================================
  // CLEANUP: Remove existing Pijača categories, items, and modifier groups
  // ============================================
  console.log('🗑️ Cleaning existing drink data...')

  // Find the Pijača menu
  const drinksMenu = await db.menu.findFirst({ where: { name: 'Pijača' } })
  if (!drinksMenu) {
    console.log('❌ Pijača menu not found! Creating it...')
    await db.menu.create({ data: { name: 'Pijača', icon: '🥤', color: '#3b82f6', sortOrder: 1 } })
  }

  // Delete order items linked to drink menu items
  const drinkCategories = await db.category.findMany({ where: { menuId: drinksMenu!.id } })
  const drinkCategoryIds = drinkCategories.map(c => c.id)
  const drinkMenuItems = await db.menuItem.findMany({ where: { categoryId: { in: drinkCategoryIds } } })
  const drinkMenuItemIds = drinkMenuItems.map(i => i.id)

  if (drinkMenuItemIds.length > 0) {
    await db.orderItem.deleteMany({ where: { menuItemId: { in: drinkMenuItemIds } } })
    await db.menuItemModifierGroup.deleteMany({ where: { menuItemId: { in: drinkMenuItemIds } } })
    await db.inventoryItem.deleteMany({ where: { menuItemId: { in: drinkMenuItemIds } } })
    await db.menuItem.deleteMany({ where: { id: { in: drinkMenuItemIds } } })
  }
  await db.category.deleteMany({ where: { id: { in: drinkCategoryIds } } })

  // Delete old modifier groups used for drinks
  const oldDrinkModifiers = await db.modifierGroup.findMany({
    where: { name: { in: ['Velikost piva', 'Vrsta vina', 'Led'] } }
  })
  for (const mg of oldDrinkModifiers) {
    await db.menuItemModifierGroup.deleteMany({ where: { modifierGroupId: mg.id } })
    await db.modifier.deleteMany({ where: { modifierGroupId: mg.id } })
  }
  await db.modifierGroup.deleteMany({
    where: { name: { in: ['Velikost piva', 'Vrsta vina', 'Led'] } }
  })

  console.log('✅ Cleanup complete')

  // ============================================
  // CREATE MODIFIER GROUPS FOR DRINKS
  // ============================================
  console.log('📋 Creating modifier groups...')

  const [
    wineGlassBottle, wineGlassBottle2, beerSizeTap, beerSizeBottle,
    liquorWineSize, waterSize, iceChoice, milkChoice, sweetenerChoice, alcoholAdd,
    wineSizeGeneral, kerosSize
  ] = await Promise.all([

    // Wine: glass (0.10L) vs bottle (0.75L)
    db.modifierGroup.create({ data: { name: 'Velikost vina', required: true, minSelect: 1, maxSelect: 1, sortOrder: 0, modifiers: { create: [
      { name: 'Kozarec (0.10L)', price: 0, sortOrder: 0 },
      { name: 'Steklenica (0.75L)', price: 0, sortOrder: 1 }, // price diff calculated per item
    ] } } }),

    // Wine: glass (0.10L) vs bottle (0.75L) - for items with bigger price gap
    db.modifierGroup.create({ data: { name: 'Velikost vina', required: true, minSelect: 1, maxSelect: 1, sortOrder: 0, modifiers: { create: [
      { name: 'Kozarec (0.10L)', price: 0, sortOrder: 0 },
      { name: 'Steklenica (0.75L)', price: 0, sortOrder: 1 },
    ] } } }),

    // Draft beer: 0.30L vs 0.50L
    db.modifierGroup.create({ data: { name: 'Velikost piva', required: true, minSelect: 1, maxSelect: 1, sortOrder: 1, modifiers: { create: [
      { name: '0.30L', price: 0, sortOrder: 0 },
      { name: '0.50L', price: 0, sortOrder: 1 },
    ] } } }),

    // Bottle beer: 0.33L
    db.modifierGroup.create({ data: { name: 'Velikost', required: false, minSelect: 0, maxSelect: 1, sortOrder: 2, modifiers: { create: [
      { name: '0.33L', price: 0, sortOrder: 0 },
    ] } } }),

    // Liqueur wine sizes
    db.modifierGroup.create({ data: { name: 'Velikost', required: true, minSelect: 1, maxSelect: 1, sortOrder: 3, modifiers: { create: [
      { name: '0.05L', price: 0, sortOrder: 0 },
      { name: '0.50L', price: 0, sortOrder: 1 },
    ] } } }),

    // Water sizes
    db.modifierGroup.create({ data: { name: 'Velikost', required: true, minSelect: 1, maxSelect: 1, sortOrder: 4, modifiers: { create: [
      { name: '0.25L', price: 0, sortOrder: 0 },
      { name: '0.50L', price: 0, sortOrder: 1 },
      { name: '1.00L', price: 0, sortOrder: 2 },
    ] } } }),

    // Ice
    db.modifierGroup.create({ data: { name: 'Led', required: false, minSelect: 0, maxSelect: 1, sortOrder: 5, modifiers: { create: [
      { name: 'Z ledom', price: 0, sortOrder: 0 },
      { name: 'Brez ledu', price: 0, sortOrder: 1 },
    ] } } }),

    // Milk type - for coffee
    db.modifierGroup.create({ data: { name: 'Vrsta mleka', required: false, minSelect: 0, maxSelect: 1, sortOrder: 6, modifiers: { create: [
      { name: 'Kravje mleko', price: 0, sortOrder: 0 },
      { name: 'Ovseno mleko', price: 0.50, sortOrder: 1 },
      { name: 'Mandljevo mleko', price: 0.50, sortOrder: 2 },
      { name: 'Sojino mleko', price: 0.50, sortOrder: 3 },
    ] } } }),

    // Sweetener
    db.modifierGroup.create({ data: { name: 'Sladilo', required: false, minSelect: 0, maxSelect: 1, sortOrder: 7, modifiers: { create: [
      { name: 'Sladkor', price: 0, sortOrder: 0 },
      { name: 'Med', price: 0.30, sortOrder: 1 },
      { name: 'Stevia', price: 0.30, sortOrder: 2 },
    ] } } }),

    // Alcohol addition for coffee
    db.modifierGroup.create({ data: { name: 'Alkoholni dodatek', required: false, minSelect: 0, maxSelect: 1, sortOrder: 8, modifiers: { create: [
      { name: 'Amaretto', price: 2.50, sortOrder: 0 },
      { name: 'Baileys', price: 2.50, sortOrder: 1 },
      { name: 'Kahlua', price: 2.50, sortOrder: 2 },
    ] } } }),

    // Wine size general (single bottle)
    db.modifierGroup.create({ data: { name: 'Velikost', required: false, minSelect: 0, maxSelect: 1, sortOrder: 9, modifiers: { create: [
      { name: '0.75L', price: 0, sortOrder: 0 },
    ] } } }),

    // Keros sizes (0.05L / 0.50L)
    db.modifierGroup.create({ data: { name: 'Velikost', required: true, minSelect: 1, maxSelect: 1, sortOrder: 10, modifiers: { create: [
      { name: '0.05L', price: 0, sortOrder: 0 },
      { name: '0.50L', price: 0, sortOrder: 1 },
    ] } } }),
  ])

  // Update modifier prices for wine glass/bottle
  // For Cuvee Emino: glass €3.00, bottle €21.00 -> modifier adds €18.00
  // We'll handle this per-item by setting base price as glass price and bottle modifier adds the difference

  console.log('✅ Modifier groups created')

  // ============================================
  // CREATE CATEGORIES UNDER PIJAČA
  // ============================================
  console.log('📂 Creating drink categories...')

  const categories = await Promise.all([
    db.category.create({ data: { name: 'Penine in Šampanjci', icon: '🥂', color: '#f59e0b', sortOrder: 0, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Bela Vina', icon: '🥂', color: '#fbbf24', sortOrder: 1, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Rosé Vino', icon: '🌸', color: '#f472b6', sortOrder: 2, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Rdeča Vina', icon: '🍷', color: '#7c2d12', sortOrder: 3, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Tuja Vina', icon: '🌍', color: '#6366f1', sortOrder: 4, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Likersko Vino', icon: '🍷', color: '#a855f7', sortOrder: 5, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Točeno Pivo', icon: '🍺', color: '#d97706', sortOrder: 6, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Pivo', icon: '🍻', color: '#ea580c', sortOrder: 7, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Craft Piva', icon: '🍻', color: '#65a30d', sortOrder: 8, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Brezalkoholno Pivo', icon: '🍺', color: '#14b8a6', sortOrder: 9, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Viski', icon: '🥃', color: '#92400e', sortOrder: 10, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Gin', icon: '🍸', color: '#0ea5e9', sortOrder: 11, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Likerji', icon: '🍹', color: '#a855f7', sortOrder: 12, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Grenčice', icon: '🫒', color: '#4d7c0f', sortOrder: 13, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Destilati', icon: '🥃', color: '#6b21a8', sortOrder: 14, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Topli Napitki', icon: '☕', color: '#92400e', sortOrder: 15, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Mešane Pijače', icon: '🍹', color: '#ec4899', sortOrder: 16, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Vode', icon: '💧', color: '#0ea5e9', sortOrder: 17, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Naravni Sokovi', icon: '🧃', color: '#84cc16', sortOrder: 18, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Sokovi', icon: '🧃', color: '#22c55e', sortOrder: 19, menuId: drinksMenu!.id } }),
    db.category.create({ data: { name: 'Gazirane Pijače', icon: '🥤', color: '#ef4444', sortOrder: 20, menuId: drinksMenu!.id } }),
  ])

  const [
    penine, belaVina, roseVino, rdecaVina, tujaVina, likerskoVino,
    tocenoPivo, pivo, craftPiva, brezalkPivo, viski, gin, likerji,
    grencice, destilati, topliNapitki, mesanePijace, vode, naravniSokovi, sokovi, gaziranePijace
  ] = categories

  console.log('✅ Categories created')

  // ============================================
  // CREATE MENU ITEMS
  // ============================================
  console.log('📝 Creating menu items...')

  type ItemData = {
    name: string
    description: string
    price: number
    image: string
    categoryId: string
    sortOrder: number
    modifierGroupIds: string[]
    sizeModifiers?: { name: string; price: number }[] // override default size modifiers
  }

  const allItems: ItemData[] = [
    // ============================================
    // PENINE IN ŠAMPANJCI (Sparkling Wines & Champagnes)
    // ============================================
    { name: 'No.1 Brut', description: 'Chardonnay, rumeni plavec | Istenič, Bizeljsko-Sremič, Posavje | Zelo suho', price: 40.00, image: '/menu-images/penine/no1-brut.png', categoryId: penine.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Domaine Slapšak Brut Reserve', description: 'Žametna črnina, modri pinot | Domaine Slapšak, Dolenjska, Posavje | Zelo suho', price: 45.00, image: '/menu-images/penine/slapsak-brut-reserve.png', categoryId: penine.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Domaine Slapšak Brut Rosé', description: '100% žametna črnina | Domaine Slapšak, Dolenjska, Posavje | Zelo suho', price: 45.00, image: '/menu-images/penine/slapsak-brut-rose.png', categoryId: penine.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Penina Gourmet Rosé', description: '100% modri pinot | Klet Istenič, Bizeljsko-Sremič, Posavje | Suho', price: 40.00, image: '/menu-images/penine/gourmet-rose.png', categoryId: penine.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Zlata Radgonska Penina Brut Selection', description: 'Chardonnay | Radgonske gorice, Gornja radgona, Štajerska, Podravje | Zelo suho', price: 36.00, image: '/menu-images/penine/zlata-radgonska.png', categoryId: penine.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Maria Brut 2020', description: 'Chardonnay, rumeni plavec, kraljevina | Vinarstvo Kerin, Dolenjska, Posavje | Zelo suho', price: 35.00, image: '/menu-images/penine/maria-brut.png', categoryId: penine.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Penina Boemme Rumeni Muškat', description: 'Hiša vin Emino, Štajerska Slovenija | Polsuho', price: 35.00, image: '/menu-images/penine/boemme-rumeni-muskat.png', categoryId: penine.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Bjana Brut', description: 'Chardonnay, modri pinot | Bjana, Miran Sirk, Goriška Brda, Primorska | Zelo suho', price: 55.00, image: '/menu-images/penine/bjana-brut.png', categoryId: penine.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Mufi Pet Nat Brut Nature 2023', description: 'Rumeni muškat, rumeni plavec | Ekološko, Keltis, Bizeljsko-Sremič, Posavje | Izredno suho', price: 35.00, image: '/menu-images/penine/mufi-pet-nat.png', categoryId: penine.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Champagne Louis Roederer Collection 244 Brut', description: 'Chardonnay, pinot noir, pinot meunier | Louis Roederer, Reims, Francija | Zelo suho', price: 102.00, image: '/menu-images/penine/louis-roederer.png', categoryId: penine.id, sortOrder: 9, modifierGroupIds: [] },
    { name: 'Champagne Pol Roger Brut Reserve', description: 'Chardonnay, modri pinot, pinot meunier | Epernay, Francija | Zelo suho', price: 102.00, image: '/menu-images/penine/pol-roger.png', categoryId: penine.id, sortOrder: 10, modifierGroupIds: [] },
    { name: 'Moët & Chandon Imperial Brut', description: 'Pinot noir, pinot meunier, chardonnay | Moët&Chandon, Epernay, Francija | Zelo suho', price: 95.00, image: '/menu-images/penine/moet-chandon.png', categoryId: penine.id, sortOrder: 11, modifierGroupIds: [] },
    { name: 'Dom Pérignon Brut 2013', description: 'Chardonnay, modri pinot | Epernay, Francija | Zelo suho', price: 390.00, image: '/menu-images/penine/dom-perignon.png', categoryId: penine.id, sortOrder: 12, modifierGroupIds: [] },

    // ============================================
    // BELA VINA (White Wines)
    // ============================================
    { name: 'Cuvee Emino 2022 (kozarec)', description: 'Laški rizling, chardonnay, sauvignon | Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.10L', price: 3.00, image: '/menu-images/bela-vina/cuvee-emino.png', categoryId: belaVina.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Cuvee Emino 2022 (steklenica)', description: 'Laški rizling, chardonnay, sauvignon | Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.75L', price: 21.00, image: '/menu-images/bela-vina/cuvee-emino.png', categoryId: belaVina.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Chardonnay Verus 2023', description: 'Verus, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/chardonnay-verus.png', categoryId: belaVina.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Sauvignon Blanc Cru Veliki Vrh 2023', description: 'Familija Brodnjak, Haloze, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 42.00, image: '/menu-images/bela-vina/sauvignon-blanc-cru.png', categoryId: belaVina.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Laški Rizling 2021', description: 'Janez Colnar, Dolenjska | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/laski-rizling.png', categoryId: belaVina.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Traminec 2023', description: 'Butična klet Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 39.00, image: '/menu-images/bela-vina/traminec.png', categoryId: belaVina.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Rebula 2022', description: 'Borut Blažič, Goriška Brda, Primorska | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/rebula.png', categoryId: belaVina.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Chardonnay Dular 2022', description: 'Ekološko vino | Klet Dular, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 50.00, image: '/menu-images/bela-vina/chardonnay-dular.png', categoryId: belaVina.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Chardonnay Domaine Vicomte de Noue 2020', description: 'Marinčič Tejca, Vedrignano II Cru, Goriška Brda, Primorska | Suho | 0.75L', price: 120.00, image: '/menu-images/bela-vina/chardonnay-vicomte.png', categoryId: belaVina.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Šipon Verus 2022', description: 'Verus, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 35.00, image: '/menu-images/bela-vina/sipon-verus.png', categoryId: belaVina.id, sortOrder: 9, modifierGroupIds: [] },
    { name: 'Sivi Pinot Jamertal 2021', description: 'Valdhuber, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 38.00, image: '/menu-images/bela-vina/sivi-pinot-jamertal.png', categoryId: belaVina.id, sortOrder: 10, modifierGroupIds: [] },
    { name: 'Renski Rizling Stare Trte 2015', description: 'Dveri-Pax, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 39.00, image: '/menu-images/bela-vina/renski-rizling-stare.png', categoryId: belaVina.id, sortOrder: 11, modifierGroupIds: [] },
    { name: 'Renski Rizling Keltis 2021', description: 'Ekološko vino | Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 44.00, image: '/menu-images/bela-vina/renski-rizling-keltis.png', categoryId: belaVina.id, sortOrder: 12, modifierGroupIds: [] },
    { name: 'Alter 2021', description: 'Ekološko vino | Renski rizling, laški rizling, sivi pinot | Kmetija Šumenjak, Štajerska, Podravje | Suho | 0.75L', price: 42.00, image: '/menu-images/bela-vina/alter.png', categoryId: belaVina.id, sortOrder: 13, modifierGroupIds: [] },
    { name: 'Malvazija Malval Movia 2023', description: 'Movia, Goriška Brda, Primorska | Suho | 0.75L', price: 36.00, image: '/menu-images/bela-vina/malvazija-movia.png', categoryId: belaVina.id, sortOrder: 14, modifierGroupIds: [] },
    { name: 'Rebula Cru Selection 2021', description: 'Marjan Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 55.00, image: '/menu-images/bela-vina/rebula-cru.png', categoryId: belaVina.id, sortOrder: 15, modifierGroupIds: [] },
    { name: 'Burja Bela 2022', description: 'Ekološko Demeter | Malvazija, laški rizling, rebula | Posestvo Burja, Vipavska dolina, Primorska | Suho | 0.75L', price: 40.00, image: '/menu-images/bela-vina/burja-bela.png', categoryId: belaVina.id, sortOrder: 16, modifierGroupIds: [] },
    { name: 'Angel Belo Grande Cuvee 2021', description: 'Ekološko vino | Chardonnay, sauvignon, pinela, laški rizling, sivi pinot | Klet Batič, Vipavska dolina, Primorska | Suho | 0.75L', price: 66.00, image: '/menu-images/bela-vina/angel-belo-2021.png', categoryId: belaVina.id, sortOrder: 17, modifierGroupIds: [] },
    { name: 'Angel Belo Grande Cuvee 2019', description: 'Ekološko vino | Chardonnay, sauvignon, pinela, laški rizling, sivi pinot | Klet Batič, Vipavska dolina, Primorska | Suho | 3.00L', price: 280.00, image: '/menu-images/bela-vina/angel-belo-2019.png', categoryId: belaVina.id, sortOrder: 18, modifierGroupIds: [] },
    { name: 'Rumeni Muškat 2023 (kozarec)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.10L', price: 4.50, image: '/menu-images/bela-vina/rumeni-muskat.png', categoryId: belaVina.id, sortOrder: 19, modifierGroupIds: [] },
    { name: 'Rumeni Muškat 2023 (steklenica)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.75L', price: 30.00, image: '/menu-images/bela-vina/rumeni-muskat.png', categoryId: belaVina.id, sortOrder: 20, modifierGroupIds: [] },
    { name: 'Rumeni Muškat Pozna Trgatev 2019 (kozarec)', description: 'Klet Prus, Metlika, Bela Krajina, Posavje | Sladko | 0.10L', price: 6.50, image: '/menu-images/bela-vina/rumeni-muskat-pozna.png', categoryId: belaVina.id, sortOrder: 21, modifierGroupIds: [] },
    { name: 'Rumeni Muškat Pozna Trgatev 2019 (steklenica)', description: 'Klet Prus, Metlika, Bela Krajina, Posavje | Sladko | 0.75L', price: 38.00, image: '/menu-images/bela-vina/rumeni-muskat-pozna.png', categoryId: belaVina.id, sortOrder: 22, modifierGroupIds: [] },
    { name: 'Bela Frankinja 2023 (kozarec)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.10L', price: 5.00, image: '/menu-images/bela-vina/bela-frankinja.png', categoryId: belaVina.id, sortOrder: 23, modifierGroupIds: [] },
    { name: 'Bela Frankinja 2023 (steklenica)', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Polsladko | 0.75L', price: 35.00, image: '/menu-images/bela-vina/bela-frankinja.png', categoryId: belaVina.id, sortOrder: 24, modifierGroupIds: [] },

    // ============================================
    // ROSÉ VINO (Rosé Wine)
    // ============================================
    { name: 'Rosé Batič 2024', description: 'Cabernet sauvignon | Batič, Vipavska dolina, Primorska | Polsuho | 0.75L', price: 43.00, image: '/menu-images/rose-vino/rose-batic.png', categoryId: roseVino.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Rosé Verstovšek Estate 2024 (kozarec)', description: 'Modra frankinja | Verstovšek Estate, Bizeljsko-Sremič, Posavje | Suho | 0.10L', price: 4.80, image: '/menu-images/rose-vino/rose-verstovsek.png', categoryId: roseVino.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Rosé Verstovšek Estate 2024 (steklenica)', description: 'Modra frankinja | Verstovšek Estate, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 35.00, image: '/menu-images/rose-vino/rose-verstovsek.png', categoryId: roseVino.id, sortOrder: 2, modifierGroupIds: [] },

    // ============================================
    // RDEČA VINA (Red Wines)
    // ============================================
    { name: 'Modra Frankinja Emino 2023 (kozarec)', description: 'Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.10L', price: 3.00, image: '/menu-images/rdeca-vina/modra-frankinja-emino.png', categoryId: rdecaVina.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Modra Frankinja Emino 2023 (steklenica)', description: 'Hiša vin Emino, Šmarje pri Jelšah, Štajerska | Suho | 0.75L', price: 21.00, image: '/menu-images/rdeca-vina/modra-frankinja-emino.png', categoryId: rdecaVina.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Modra Frankinja Dular 2023', description: 'Klet Dular, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 30.00, image: '/menu-images/rdeca-vina/modra-frankinja-dular.png', categoryId: rdecaVina.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Modra Frankinja Luna 2021', description: 'Kmetija Kobal, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 68.00, image: '/menu-images/rdeca-vina/modra-frankinja-luna.png', categoryId: rdecaVina.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Modri Pinot Verus 2019', description: 'Verus, Ormož, Štajerska Slovenija, Podravje | Suho | 0.75L', price: 38.00, image: '/menu-images/rdeca-vina/modri-pinot-verus.png', categoryId: rdecaVina.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Modri Pinot Opoka 2020', description: 'Marjan Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 95.00, image: '/menu-images/rdeca-vina/modri-pinot-opoka.png', categoryId: rdecaVina.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Merlot Keltis 2018', description: 'Butična klet Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 48.00, image: '/menu-images/rdeca-vina/merlot-keltis.png', categoryId: rdecaVina.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Merlot Opoka 2019', description: 'Marjan Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 112.00, image: '/menu-images/rdeca-vina/merlot-opoka.png', categoryId: rdecaVina.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Cabernet Sauvignon Keltis 2018', description: 'Butična klet Keltis, Bizeljsko-Sremič, Posavje | Suho | 0.75L', price: 48.00, image: '/menu-images/rdeca-vina/cabernet-keltis.png', categoryId: rdecaVina.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Cabernet Sauvignon Pavo Limited Edition 2021', description: 'Dušan Kristančič, Goriška Brda, Primorska | Suho | 0.75L', price: 87.00, image: '/menu-images/rdeca-vina/cabernet-pavo.png', categoryId: rdecaVina.id, sortOrder: 9, modifierGroupIds: [] },
    { name: 'Guerila Retro Selection 2020', description: 'Merlot, cabernet sauvignon, barbera | Klet Guerila, Vipavska dolina, Primorska | Suho | 0.75L', price: 50.00, image: '/menu-images/rdeca-vina/guerila-retro.png', categoryId: rdecaVina.id, sortOrder: 10, modifierGroupIds: [] },
    { name: 'Duet Edi Simčič 2021', description: 'Merlot, cabernet sauvignon, cabernet franc | Edi Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 64.00, image: '/menu-images/rdeca-vina/duet-edi-simcic.png', categoryId: rdecaVina.id, sortOrder: 11, modifierGroupIds: [] },
    { name: 'Duet Lex Edi Simčič 2018', description: 'Merlot, cabernet sauvignon, cabernet franc | Edi Simčič, Goriška Brda, Primorska | Suho | 1.50L', price: 200.00, image: '/menu-images/rdeca-vina/duet-lex-2018.png', categoryId: rdecaVina.id, sortOrder: 12, modifierGroupIds: [] },
    { name: 'Duet Lex Edi Simčič 2020', description: 'Merlot, cabernet sauvignon, cabernet franc | Edi Simčič, Goriška Brda, Primorska | Suho | 0.75L', price: 95.00, image: '/menu-images/rdeca-vina/duet-lex-2020.png', categoryId: rdecaVina.id, sortOrder: 13, modifierGroupIds: [] },
    { name: 'Carolina Rdeča 2018', description: 'Cabernet sauvignon, cabernet franc, merlot | Kmetija Jakončič, Goriška Brda, Primorska | Suho | 0.75L', price: 71.00, image: '/menu-images/rdeca-vina/carolina-rdeca.png', categoryId: rdecaVina.id, sortOrder: 14, modifierGroupIds: [] },
    { name: 'Veliko Rdeče Movia 2015', description: 'Merlot, cabernet sauvignin, modri pinot | Klet Movia, Goriška Brda, Primorska | Suho | 0.75L', price: 93.00, image: '/menu-images/rdeca-vina/veliko-rdece-movia.png', categoryId: rdecaVina.id, sortOrder: 15, modifierGroupIds: [] },

    // ============================================
    // TUJA VINA (Foreign Wines - Spogledovanje s sosedmi)
    // ============================================
    { name: 'Pošip Premium Terra Madre 2021', description: 'Belo | Terra Madre, Južna Dalmacija, Hrvaška | Suho | 0.75L', price: 30.00, image: '/menu-images/tuja-vina/posip-terra-madre.png', categoryId: tujaVina.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Andreis Vinasmora 2020', description: 'Rdeče | Babič, Vinasmora, Primošten, Hrvaška | Suho | 0.75L', price: 30.00, image: '/menu-images/tuja-vina/andreis-vinasmora.png', categoryId: tujaVina.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Plavac Mali Premium Terra Madre 2017', description: 'Rdeče | Terra Madre, Južna Dalmacija, Hrvaška | Suho | 0.75L', price: 48.00, image: '/menu-images/tuja-vina/plavac-mali-terra-madre.png', categoryId: tujaVina.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Vranec Instinct 2019', description: 'Rdeče | Puklavec Family, Makedonija | Suho | 0.75L', price: 30.00, image: '/menu-images/tuja-vina/vranec-instinct.png', categoryId: tujaVina.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Chardonnay Where Dreams Have No End 2021', description: 'Belo | Jermann, Friuli Venezia Giulia, Italija | Suho | 0.75L', price: 110.00, image: '/menu-images/tuja-vina/jermann-dreams.png', categoryId: tujaVina.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Vintage Tunina 2022', description: 'Belo | Sauvignon, chardonnay, rebula gialla, malvazija | Jermann, Friuli Venezia Giulia, Italija | Suho | 0.75L', price: 110.00, image: '/menu-images/tuja-vina/vintage-tunina.png', categoryId: tujaVina.id, sortOrder: 5, modifierGroupIds: [] },

    // ============================================
    // LIKERSKO VINO (Liqueur Wine)
    // ============================================
    { name: 'Keros Belo 2020 (0.05L)', description: 'Traminec | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 4.50, image: '/menu-images/likersko-vino/keros-belo.png', categoryId: likerskoVino.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Keros Belo 2020 (0.50L)', description: 'Traminec | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 45.00, image: '/menu-images/likersko-vino/keros-belo.png', categoryId: likerskoVino.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Keros Rdeče 2018 (0.05L)', description: 'Modra frankinja | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 4.50, image: '/menu-images/likersko-vino/keros-rdece.png', categoryId: likerskoVino.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Keros Rdeče 2018 (0.50L)', description: 'Modra frankinja | Vinarstvo Kerin, Straža nad Krškim, Dolenjska, Posavje | Sladko', price: 45.00, image: '/menu-images/likersko-vino/keros-rdece.png', categoryId: likerskoVino.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Veliko Rdeče Movia 2012', description: 'Merlot, cabernet sauvignin, modri pinot | Klet Movia, Goriška Brda, Primorska | Suho | 3.00L', price: 360.00, image: '/menu-images/likersko-vino/veliko-rdece-2012.png', categoryId: likerskoVino.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Sladki Refošk (kozarec)', description: 'Vina Koper, Slovenska Istra, Primorska | Sladko | 0.10L', price: 5.00, image: '/menu-images/likersko-vino/sladki-refosk.png', categoryId: likerskoVino.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Sladki Refošk (0.50L)', description: 'Vina Koper, Slovenska Istra, Primorska | Sladko | 0.50L', price: 25.00, image: '/menu-images/likersko-vino/sladki-refosk.png', categoryId: likerskoVino.id, sortOrder: 6, modifierGroupIds: [] },

    // ============================================
    // TOČENO PIVO (Draft Beer)
    // ============================================
    { name: 'Pivo Haler Lager Nefiltriran (0.30L)', description: 'Pivovarna Haler | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/haler-nefiltriran.png', categoryId: tocenoPivo.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Pivo Haler Lager Nefiltriran (0.50L)', description: 'Pivovarna Haler | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/haler-nefiltriran.png', categoryId: tocenoPivo.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Pivo Laško Lager (0.30L)', description: 'Pivovarna Laško | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/lasko-lager.png', categoryId: tocenoPivo.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Pivo Laško Lager (0.50L)', description: 'Pivovarna Laško | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/lasko-lager.png', categoryId: tocenoPivo.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Pivo Union Lager (0.30L)', description: 'Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/union-lager.png', categoryId: tocenoPivo.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Pivo Union Lager (0.50L)', description: 'Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/union-lager.png', categoryId: tocenoPivo.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Pelicon 3rd Pill IPA (0.30L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.30L', price: 4.50, image: '/menu-images/toceno-pivo/pelicon-ipa.png', categoryId: tocenoPivo.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Pelicon 3rd Pill IPA (0.50L)', description: 'Indian Pale Ale | Pivovarna Pelicon | 0.50L', price: 5.90, image: '/menu-images/toceno-pivo/pelicon-ipa.png', categoryId: tocenoPivo.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Radler Grenivka (0.30L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.30L', price: 3.70, image: '/menu-images/toceno-pivo/radler.png', categoryId: tocenoPivo.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Radler Grenivka (0.50L)', description: 'Grapefruit | Samo poleti | Pivovarna Union | 0.50L', price: 4.00, image: '/menu-images/toceno-pivo/radler.png', categoryId: tocenoPivo.id, sortOrder: 9, modifierGroupIds: [] },

    // ============================================
    // PIVO (Bottled Beer - Lager, Radler)
    // ============================================
    { name: 'Reset Lagerish Cream Ale (0.50L)', description: 'Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-lagerish.png', categoryId: pivo.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Reset Froggy IPA (0.50L)', description: 'Indian Pale Ale | Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-froggy.png', categoryId: pivo.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Reset Irish Extra Stout (0.50L)', description: 'Temno | Pivovarna Reset, Brežice | 0.50L', price: 5.90, image: '/menu-images/pivo/reset-stout.png', categoryId: pivo.id, sortOrder: 2, modifierGroupIds: [] },

    // ============================================
    // CRAFT PIVA (Craft Beer)
    // ============================================
    { name: 'Pelicon Winter (0.75L)', description: 'Temno | Pivovarna Pelicon | 0.75L', price: 15.00, image: '/menu-images/craft-piva/pelicon-winter.png', categoryId: craftPiva.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Zeleni Haler Lager s Konopljo (0.50L)', description: 'Pivovarna Haler | 0.50L', price: 5.90, image: '/menu-images/craft-piva/zeleni-haler.png', categoryId: craftPiva.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Bevog Tak Pale Ale (0.33L)', description: 'Pivovarna Bevog | 0.33L', price: 5.00, image: '/menu-images/craft-piva/bevog-tak.png', categoryId: craftPiva.id, sortOrder: 2, modifierGroupIds: [] },

    // ============================================
    // BREZALKOHOLNO PIVO (Non-Alcoholic & Gluten-Free Beer)
    // ============================================
    { name: 'Heineken 0.0 (0.33L)', description: 'Brezalkoholno | Pivovarna Heineken | 0.33L', price: 4.20, image: '/menu-images/brezalk-pivo/heineken-00.png', categoryId: brezalkPivo.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Daura Lager (0.33L)', description: 'Brezglutensko | Estrella Damm, Španija | 0.33L', price: 4.90, image: '/menu-images/brezalk-pivo/daura.png', categoryId: brezalkPivo.id, sortOrder: 1, modifierGroupIds: [] },

    // ============================================
    // VISKI (Whiskey)
    // ============================================
    { name: 'Chivas 12yo', description: 'Škotski, blended | 0.03L', price: 5.20, image: '/menu-images/viski/chivas-12.png', categoryId: viski.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
    { name: 'Johnnie Walker Black', description: 'Škotska, blended | 0.03L', price: 6.50, image: '/menu-images/viski/johnnie-walker-black.png', categoryId: viski.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
    { name: 'Jack Daniels', description: 'Tennessee, blended | 0.03L', price: 4.50, image: '/menu-images/viski/jack-daniels.png', categoryId: viski.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
    { name: 'Jameson', description: 'Irska, blended | 0.03L', price: 4.50, image: '/menu-images/viski/jameson.png', categoryId: viski.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
    { name: 'Lagavulin 16yo', description: 'Škotska, Islay single malt | 0.03L', price: 15.00, image: '/menu-images/viski/lagavulin-16.png', categoryId: viski.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
    { name: 'Laphroaig 10yo', description: 'Škotska, Islay, single malt | 0.03L', price: 12.00, image: '/menu-images/viski/laphroaig-10.png', categoryId: viski.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },
    { name: 'Glenmorangie Lasanta 12yo', description: 'Škotska, single malt, sherry cask finish | 0.03L', price: 10.00, image: '/menu-images/viski/glenmorangie-lasanta.png', categoryId: viski.id, sortOrder: 6, modifierGroupIds: [iceChoice.id] },
    { name: 'Glenmorangie 18yo', description: 'Škotska, Highland, single malt | 0.03L', price: 20.00, image: '/menu-images/viski/glenmorangie-18.png', categoryId: viski.id, sortOrder: 7, modifierGroupIds: [iceChoice.id] },
    { name: 'Whisky Nikka Miyagikyo', description: 'Japonska, single malt | 0.03L', price: 15.00, image: '/menu-images/viski/nikka-miyagikyo.png', categoryId: viski.id, sortOrder: 8, modifierGroupIds: [iceChoice.id] },
    { name: 'Whisky Nikka From the Barrel', description: 'Japonska, blended | 0.03L', price: 10.50, image: '/menu-images/viski/nikka-barrel.png', categoryId: viski.id, sortOrder: 9, modifierGroupIds: [iceChoice.id] },

    // ============================================
    // GIN
    // ============================================
    { name: 'Gin Kristal London Dry', description: 'Slovenija, London dry | 0.03L', price: 5.00, image: '/menu-images/gin/gin-kristal.png', categoryId: gin.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
    { name: 'Gin Monolog', description: 'Slovenija | 0.03L', price: 4.50, image: '/menu-images/gin/gin-monolog.png', categoryId: gin.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
    { name: 'Gin Hendrick\'s', description: 'Škotska | 0.03L', price: 6.50, image: '/menu-images/gin/gin-hendricks.png', categoryId: gin.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
    { name: 'Gin Mare', description: 'Španija | 0.03L', price: 7.00, image: '/menu-images/gin/gin-mare.png', categoryId: gin.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
    { name: 'Gin Tanqueray', description: 'London dry | 0.03L', price: 4.50, image: '/menu-images/gin/gin-tanqueray.png', categoryId: gin.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
    { name: 'Gin Monkey 47', description: 'Nemčija | 0.03L', price: 8.50, image: '/menu-images/gin/gin-monkey47.png', categoryId: gin.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },

    // ============================================
    // LIKERJI (Liqueurs)
    // ============================================
    { name: 'Liker Malibu Rum', description: '0.03L', price: 4.50, image: '/menu-images/likerji/malibu.png', categoryId: likerji.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
    { name: 'Liker Canella', description: '0.03L', price: 5.50, image: '/menu-images/likerji/canella.png', categoryId: likerji.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
    { name: 'Liker Rum Bumbu Cream', description: '0.03L', price: 5.50, image: '/menu-images/likerji/bumbu-cream.png', categoryId: likerji.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
    { name: 'Liker Carolans', description: '0.03L', price: 4.50, image: '/menu-images/likerji/carolans.png', categoryId: likerji.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
    { name: 'Liker Medica Kejžar', description: '0.03L', price: 4.20, image: '/menu-images/likerji/medica-kejzar.png', categoryId: likerji.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
    { name: 'Liker Borovnica Kejžar', description: '0.03L', price: 4.20, image: '/menu-images/likerji/borovnica-kejzar.png', categoryId: likerji.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },

    // ============================================
    // GRENČICE (Bitters)
    // ============================================
    { name: 'Pelinkovec Badel Antique', description: '0.03L', price: 4.20, image: '/menu-images/grencice/pelinkovec.png', categoryId: grencice.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
    { name: 'Cynar', description: '0.03L', price: 3.80, image: '/menu-images/grencice/cynar.png', categoryId: grencice.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
    { name: 'Jägermeister', description: '0.03L', price: 3.80, image: '/menu-images/grencice/jagermeister.png', categoryId: grencice.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
    { name: 'Amaro', description: '0.03L', price: 3.80, image: '/menu-images/grencice/amaro.png', categoryId: grencice.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
    { name: 'Campari Bitter', description: '0.03L', price: 3.80, image: '/menu-images/grencice/campari.png', categoryId: grencice.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
    { name: 'Aperol', description: '0.03L', price: 3.80, image: '/menu-images/grencice/aperol.png', categoryId: grencice.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },

    // ============================================
    // DESTILATI (Distillates / Spirits)
    // ============================================
    { name: 'Viljamovka', description: '0.03L', price: 5.00, image: '/menu-images/destilati/viljamovka.png', categoryId: destilati.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Slivovka', description: '0.03L', price: 5.50, image: '/menu-images/destilati/slivovka.png', categoryId: destilati.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Brinjevec', description: '0.03L', price: 5.50, image: '/menu-images/destilati/brinjevec.png', categoryId: destilati.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Grappa Sofija Rebula', description: 'Jakončič | 0.03L', price: 5.50, image: '/menu-images/destilati/grappa-sofija.png', categoryId: destilati.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Travarica Rossi', description: 'Istra | 0.03L', price: 5.00, image: '/menu-images/destilati/travarica-rossi.png', categoryId: destilati.id, sortOrder: 4, modifierGroupIds: [] },

    // ============================================
    // TOPLI NAPITKI (Hot Beverages)
    // ============================================
    { name: 'Kava Espresso', description: 'Espresso kava', price: 2.00, image: '/menu-images/topli-napitki/kava-espresso.png', categoryId: topliNapitki.id, sortOrder: 0, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
    { name: 'Kava Macchiato', description: 'Espresso s kapljico mleka', price: 2.10, image: '/menu-images/topli-napitki/kava-macchiato.png', categoryId: topliNapitki.id, sortOrder: 1, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
    { name: 'Cappuccino', description: 'Espresso s toplo mlečno peno', price: 2.30, image: '/menu-images/topli-napitki/cappuccino.png', categoryId: topliNapitki.id, sortOrder: 2, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
    { name: 'Kava z Mlekom', description: 'Kava z mlekom', price: 2.30, image: '/menu-images/topli-napitki/kava-z-mlekom.png', categoryId: topliNapitki.id, sortOrder: 3, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
    { name: 'Kava s Smetano', description: 'Kava s smetano', price: 2.50, image: '/menu-images/topli-napitki/kava-s-smetano.png', categoryId: topliNapitki.id, sortOrder: 4, modifierGroupIds: [sweetenerChoice.id, alcoholAdd.id] },
    { name: 'Bela Kava', description: 'Kava z veliko mlekom', price: 2.80, image: '/menu-images/topli-napitki/bela-kava.png', categoryId: topliNapitki.id, sortOrder: 5, modifierGroupIds: [milkChoice.id, sweetenerChoice.id, alcoholAdd.id] },
    { name: 'Kava Espresso Brez Kofeina', description: 'Dekofeinizirana espresso kava', price: 2.30, image: '/menu-images/topli-napitki/kava-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 6, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
    { name: 'Kava z Mlekom Brez Kofeina', description: 'Dekofeinizirana kava z mlekom', price: 2.50, image: '/menu-images/topli-napitki/kava-mleko-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 7, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
    { name: 'Cappuccino Brez Kofeina', description: 'Dekofeinizirani cappuccino', price: 2.60, image: '/menu-images/topli-napitki/cappuccino-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 8, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
    { name: 'Kava Macchiato Brez Kofeina', description: 'Dekofeinizirana kava macchiato', price: 2.20, image: '/menu-images/topli-napitki/macchiato-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 9, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
    { name: 'Bela Kava Brez Kofeina', description: 'Dekofeinizirana bela kava', price: 3.00, image: '/menu-images/topli-napitki/bela-kava-brez-kofeina.png', categoryId: topliNapitki.id, sortOrder: 10, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
    { name: 'Kava z Riževim Mlekom', description: 'Kava z riževim mlekom', price: 3.00, image: '/menu-images/topli-napitki/kava-rizevo-mleko.png', categoryId: topliNapitki.id, sortOrder: 11, modifierGroupIds: [sweetenerChoice.id] },
    { name: 'Kakav', description: 'Topla čokoladna pijača', price: 3.00, image: '/menu-images/topli-napitki/kakav.png', categoryId: topliNapitki.id, sortOrder: 12, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
    { name: 'Kakav s Smetano', description: 'Kakav s smetano', price: 3.50, image: '/menu-images/topli-napitki/kakav-smetana.png', categoryId: topliNapitki.id, sortOrder: 13, modifierGroupIds: [sweetenerChoice.id] },
    { name: 'Babyccino', description: 'Otroška kava', price: 1.00, image: '/menu-images/topli-napitki/babyccino.png', categoryId: topliNapitki.id, sortOrder: 14, modifierGroupIds: [] },
    { name: 'Vroča Čokolada', description: 'Gosta čokolada s smetano', price: 4.50, image: '/menu-images/topli-napitki/vroca-cokolada.png', categoryId: topliNapitki.id, sortOrder: 15, modifierGroupIds: [milkChoice.id, sweetenerChoice.id] },
    { name: 'Čaj z Limono in Medom', description: 'Topel čaj z limono in medom', price: 3.00, image: '/menu-images/topli-napitki/caj-limona-med.png', categoryId: topliNapitki.id, sortOrder: 16, modifierGroupIds: [sweetenerChoice.id, milkChoice.id] },
    { name: 'Ledena Kava Olimia', description: 'Kava, sladoled, čokolada, smetana', price: 6.50, image: '/menu-images/topli-napitki/ledena-kava-olimia.png', categoryId: topliNapitki.id, sortOrder: 17, modifierGroupIds: [iceChoice.id] },

    // ============================================
    // MEŠANE PIJAČE (Mixed Drinks / Cocktails)
    // ============================================
    { name: 'Aperol Spritz', description: 'Aperol, prosecco, soda, pomaranča', price: 7.50, image: '/menu-images/mesane-pijace/aperol-spritz.png', categoryId: mesanePijace.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
    { name: 'Martini Spritz', description: 'Martini bianco, prosecco, soda, limeta', price: 8.00, image: '/menu-images/mesane-pijace/martini-spritz.png', categoryId: mesanePijace.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
    { name: 'Negroni', description: 'Gin, vermut, campari, pomaranča', price: 7.50, image: '/menu-images/mesane-pijace/negroni.png', categoryId: mesanePijace.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
    { name: 'Cuba Libre', description: 'Rum Havana, Coca-Cola, limeta', price: 8.00, image: '/menu-images/mesane-pijace/cuba-libre.png', categoryId: mesanePijace.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
    { name: 'Mojito', description: 'Rum, soda, sladkor, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/mojito.png', categoryId: mesanePijace.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
    { name: 'Mango Mojito', description: 'Rum, soda, mango Monin, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/mango-mojito.png', categoryId: mesanePijace.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },
    { name: 'Strawberry Mojito', description: 'Rum, soda, jagoda Monin, meta, limeta', price: 8.50, image: '/menu-images/mesane-pijace/strawberry-mojito.png', categoryId: mesanePijace.id, sortOrder: 6, modifierGroupIds: [iceChoice.id] },
    { name: 'London Dry Gin Tonic', description: 'Gin Kristal London dry, Fever Tree tonic water, limeta', price: 8.00, image: '/menu-images/mesane-pijace/london-dry-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 7, modifierGroupIds: [iceChoice.id] },
    { name: 'Monologue Gin Tonic', description: 'Slovenija | Tonic water, brinove jagode, limeta', price: 8.00, image: '/menu-images/mesane-pijace/monolog-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 8, modifierGroupIds: [iceChoice.id] },
    { name: 'Hendrick\'s Gin Tonic', description: 'Škotska | Tonic water, kumara', price: 8.50, image: '/menu-images/mesane-pijace/hendricks-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 9, modifierGroupIds: [iceChoice.id] },
    { name: 'Gin Mare Tonic', description: 'Španija | Mediterranean tonik, limeta, rožmarin', price: 8.50, image: '/menu-images/mesane-pijace/gin-mare-tonic.png', categoryId: mesanePijace.id, sortOrder: 10, modifierGroupIds: [iceChoice.id] },
    { name: 'Monkey 47 Gin Tonic', description: 'Nemčija | Tonic water, brinove jagode, rožmarin, limona', price: 9.00, image: '/menu-images/mesane-pijace/monkey47-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 11, modifierGroupIds: [iceChoice.id] },
    { name: 'Orange & Ginger Gin Tonic', description: 'Gin Kristal Orange&Ginger, Ginger Ale tonic, pomaranča', price: 8.00, image: '/menu-images/mesane-pijace/orange-ginger-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 12, modifierGroupIds: [iceChoice.id] },
    { name: 'Raspberry Pink Gin Tonic', description: 'Gin Kristal Raspberry, Rhubarb&Raspberry tonic, meta', price: 8.00, image: '/menu-images/mesane-pijace/raspberry-pink-gin-tonic.png', categoryId: mesanePijace.id, sortOrder: 13, modifierGroupIds: [iceChoice.id] },

    // ============================================
    // VODE (Waters)
    // ============================================
    { name: 'Mineralna Voda (0.25L)', description: 'Mineralna voda | 0.25L', price: 2.50, image: '/menu-images/vode/mineralna-voda.png', categoryId: vode.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Mineralna Voda (0.50L)', description: 'Mineralna voda | 0.50L', price: 3.50, image: '/menu-images/vode/mineralna-voda.png', categoryId: vode.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Mineralna Voda (1.00L)', description: 'Mineralna voda | 1.00L', price: 5.00, image: '/menu-images/vode/mineralna-voda.png', categoryId: vode.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Naravna Voda (0.25L)', description: 'Naravna voda | 0.25L', price: 2.50, image: '/menu-images/vode/naravna-voda.png', categoryId: vode.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Naravna Voda (0.50L)', description: 'Naravna voda | 0.50L', price: 3.50, image: '/menu-images/vode/naravna-voda.png', categoryId: vode.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Naravna Voda (1.00L)', description: 'Naravna voda | 1.00L', price: 5.00, image: '/menu-images/vode/naravna-voda.png', categoryId: vode.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Naravna Voda z Okusom (0.50L)', description: 'Okusna naravna voda | PVC 0.50L', price: 3.50, image: '/menu-images/vode/voda-z-okusom.png', categoryId: vode.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Voda Radenska FunctionALL (0.50L)', description: 'Funkcionalna voda | PVC 0.50L', price: 3.50, image: '/menu-images/vode/radenska-functionall.png', categoryId: vode.id, sortOrder: 7, modifierGroupIds: [] },

    // ============================================
    // NARAVNI SOKOVI (Natural Juices)
    // ============================================
    { name: 'Limonada (0.35L)', description: 'Klasična limonada | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/limonada.png', categoryId: naravniSokovi.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
    { name: 'Limonada z Okusom (0.35L)', description: 'Meta, bezeg, ingver | 0.35L', price: 4.50, image: '/menu-images/naravni-sokovi/limonada-okus.png', categoryId: naravniSokovi.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
    { name: 'Hišni Sok Meta (0.35L)', description: 'Domač metin sok | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/hisni-sok-meta.png', categoryId: naravniSokovi.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
    { name: 'Hišni Ledeni Čaj (0.35L)', description: 'Domač ledeni čaj | 0.35L', price: 3.80, image: '/menu-images/naravni-sokovi/hisni-ledeni-caj.png', categoryId: naravniSokovi.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
    { name: 'Naravni Pomarančni Sok (0.10L)', description: 'Sveže stisnjen pomarančni sok | 0.10L', price: 2.00, image: '/menu-images/naravni-sokovi/pomarancni-sok.png', categoryId: naravniSokovi.id, sortOrder: 4, modifierGroupIds: [] },

    // ============================================
    // SOKOVI (Juices)
    // ============================================
    { name: 'Marelični Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/marelicni-sok.png', categoryId: sokovi.id, sortOrder: 0, modifierGroupIds: [] },
    { name: 'Naravni Jabolčni Sok 100% (0.20L)', description: '100% naravni | 0.20L', price: 3.80, image: '/menu-images/sokovi/jabolcni-sok.png', categoryId: sokovi.id, sortOrder: 1, modifierGroupIds: [] },
    { name: 'Ribezov Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/ribezov-sok.png', categoryId: sokovi.id, sortOrder: 2, modifierGroupIds: [] },
    { name: 'Ananasov Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/ananasov-sok.png', categoryId: sokovi.id, sortOrder: 3, modifierGroupIds: [] },
    { name: 'Pomarančni Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/pomarancni-sok.png', categoryId: sokovi.id, sortOrder: 4, modifierGroupIds: [] },
    { name: 'Jagodni Sok (0.20L)', description: '0.20L', price: 3.50, image: '/menu-images/sokovi/jagodni-sok.png', categoryId: sokovi.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Ledeni Čaj (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/sokovi/ledeni-caj.png', categoryId: sokovi.id, sortOrder: 6, modifierGroupIds: [iceChoice.id] },
    { name: 'Cedevita (0.30L)', description: '0.30L', price: 3.50, image: '/menu-images/sokovi/cedevita.png', categoryId: sokovi.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Bubble Tea (0.36L)', description: '0.36L', price: 6.50, image: '/menu-images/sokovi/bubble-tea.png', categoryId: sokovi.id, sortOrder: 8, modifierGroupIds: [iceChoice.id] },

    // ============================================
    // GAZIRANE PIJAČE (Carbonated Drinks)
    // ============================================
    { name: 'Coca Cola (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/coca-cola.png', categoryId: gaziranePijace.id, sortOrder: 0, modifierGroupIds: [iceChoice.id] },
    { name: 'Coca Cola Zero (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/coca-cola-zero.png', categoryId: gaziranePijace.id, sortOrder: 1, modifierGroupIds: [iceChoice.id] },
    { name: 'Fanta (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/fanta.png', categoryId: gaziranePijace.id, sortOrder: 2, modifierGroupIds: [iceChoice.id] },
    { name: 'Cockta (0.275L)', description: 'Slovenska originalna | 0.275L', price: 3.50, image: '/menu-images/gazirane-pijace/cockta.png', categoryId: gaziranePijace.id, sortOrder: 3, modifierGroupIds: [iceChoice.id] },
    { name: 'Sprite (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/sprite.png', categoryId: gaziranePijace.id, sortOrder: 4, modifierGroupIds: [iceChoice.id] },
    { name: 'Schweppes Tonic Water (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/schweppes-tonic.png', categoryId: gaziranePijace.id, sortOrder: 5, modifierGroupIds: [iceChoice.id] },
    { name: 'Schweppes Bitter Lemon (0.25L)', description: '0.25L', price: 3.50, image: '/menu-images/gazirane-pijace/schweppes-bitter.png', categoryId: gaziranePijace.id, sortOrder: 6, modifierGroupIds: [iceChoice.id] },
    { name: 'Fever Tree Tonic Water (0.20L)', description: 'Premium tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-tonic.png', categoryId: gaziranePijace.id, sortOrder: 7, modifierGroupIds: [iceChoice.id] },
    { name: 'Fever Tree Mediterranean Tonic (0.20L)', description: 'Premium mediteranski tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-med.png', categoryId: gaziranePijace.id, sortOrder: 8, modifierGroupIds: [iceChoice.id] },
    { name: 'Fever Tree Rhubarb & Raspberry Tonic (0.20L)', description: 'Premium rabarbara & malina tonik | 0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/fever-tree-rhubarb.png', categoryId: gaziranePijace.id, sortOrder: 9, modifierGroupIds: [iceChoice.id] },
    { name: 'Red Bull (0.20L)', description: '0.20L', price: 4.00, image: '/menu-images/gazirane-pijace/red-bull.png', categoryId: gaziranePijace.id, sortOrder: 10, modifierGroupIds: [iceChoice.id] },
  ]

  // ============================================
  // INSERT ALL ITEMS
  // ============================================
  console.log(`📝 Inserting ${allItems.length} menu items...`)

  let itemCount = 0
  for (const itemData of allItems) {
    const { modifierGroupIds, sizeModifiers, ...itemFields } = itemData as any
    const item = await db.menuItem.create({ data: itemFields })
    
    // Link modifier groups
    if (modifierGroupIds && modifierGroupIds.length > 0) {
      for (let i = 0; i < modifierGroupIds.length; i++) {
        await db.menuItemModifierGroup.create({
          data: { menuItemId: item.id, modifierGroupId: modifierGroupIds[i], sortOrder: i }
        })
      }
    }
    
    itemCount++
    if (itemCount % 20 === 0) {
      console.log(`  ... ${itemCount}/${allItems.length} items created`)
    }
  }

  console.log(`✅ All ${itemCount} menu items created`)

  // Also add Konjak, Vinjak in Rum items to Destilati category
  const konjakRumItems: ItemData[] = [
    { name: 'Hennessy V.S.', description: 'Konjak | 0.03L', price: 6.50, image: '/menu-images/destilati/hennessy-vs.png', categoryId: destilati.id, sortOrder: 5, modifierGroupIds: [] },
    { name: 'Hennessy X.O.', description: 'Konjak | 0.03L', price: 25.00, image: '/menu-images/destilati/hennessy-xo.png', categoryId: destilati.id, sortOrder: 6, modifierGroupIds: [] },
    { name: 'Cognac Delamaine X.O.', description: 'Konjak | 0.03L', price: 25.00, image: '/menu-images/destilati/delamaine-xo.png', categoryId: destilati.id, sortOrder: 7, modifierGroupIds: [] },
    { name: 'Ararat 6yo', description: 'Vinjak | 0.03L', price: 5.50, image: '/menu-images/destilati/ararat-6.png', categoryId: destilati.id, sortOrder: 8, modifierGroupIds: [] },
    { name: 'Ararat 15yo', description: 'Vinjak | 0.03L', price: 12.50, image: '/menu-images/destilati/ararat-15.png', categoryId: destilati.id, sortOrder: 9, modifierGroupIds: [] },
    { name: 'Ararat 20yo', description: 'Vinjak | 0.03L', price: 17.50, image: '/menu-images/destilati/ararat-20.png', categoryId: destilati.id, sortOrder: 10, modifierGroupIds: [] },
    { name: 'Rum Bumbu Original', description: '0.03L', price: 6.50, image: '/menu-images/destilati/rum-bumbu.png', categoryId: destilati.id, sortOrder: 11, modifierGroupIds: [iceChoice.id] },
    { name: 'Rum Zacapa Solera 23yo', description: 'Guatemala | 0.03L', price: 15.00, image: '/menu-images/destilati/rum-zacapa.png', categoryId: destilati.id, sortOrder: 12, modifierGroupIds: [iceChoice.id] },
    { name: 'Rum Diplomatico Reserva Exclusiva', description: 'Venezuela | 0.03L', price: 7.50, image: '/menu-images/destilati/rum-diplomatico.png', categoryId: destilati.id, sortOrder: 13, modifierGroupIds: [iceChoice.id] },
    { name: 'Rum La Hechicera Reserva Familiar 21yo', description: 'Kolumbija | 0.03L', price: 8.00, image: '/menu-images/destilati/rum-hechicera.png', categoryId: destilati.id, sortOrder: 14, modifierGroupIds: [iceChoice.id] },
  ]

  console.log(`📝 Adding ${konjakRumItems.length} konjak/rum items...`)
  for (const itemData of konjakRumItems) {
    const { modifierGroupIds: mIds, ...fields } = itemData as any
    const item = await db.menuItem.create({ data: fields })
    if (mIds && mIds.length > 0) {
      for (let i = 0; i < mIds.length; i++) {
        await db.menuItemModifierGroup.create({
          data: { menuItemId: item.id, modifierGroupId: mIds[i], sortOrder: i }
        })
      }
    }
  }

  // Rename category to include konjak/rum
  await db.category.update({
    where: { id: destilati.id },
    data: { name: 'Destilati, Konjak in Rum', icon: '🥃' }
  })

  console.log('✅ All drink items seeded successfully!')

  // ============================================
  // STATISTICS
  // ============================================
  const finalCategories = await db.category.findMany({ where: { menuId: drinksMenu!.id } })
  const finalItems = await db.menuItem.findMany({
    where: { categoryId: { in: finalCategories.map(c => c.id) } }
  })

  console.log('\n📊 Summary:')
  console.log(`  Categories: ${finalCategories.length}`)
  console.log(`  Total items: ${finalItems.length}`)
  for (const cat of finalCategories) {
    const catItems = finalItems.filter(i => i.categoryId === cat.id)
    console.log(`  ${cat.icon} ${cat.name}: ${catItems.length} items`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })

import { db } from '@/lib/db'

// ============================================
// SEED: Menus & Categories
// ============================================
export async function seedMenusAndCategories() {
  const [foodMenu, drinksMenu] = await Promise.all([
    db.menu.create({ data: { name: 'Hrana', icon: '🍽️', color: '#f59e0b', sortOrder: 0 } }),
    db.menu.create({ data: { name: 'Pijača', icon: '🥤', color: '#3b82f6', sortOrder: 1 } }),
  ])

  const [hladnePredjedi, toplePredjedi, juhe, glavneJedi, testenine, rizote, kalamari, ribjeJedi, solate, pizza, burgerji, vegetarijanske, palacinke, sladice, outroskeJedi, malice, priloge, omake] = await Promise.all([
    db.category.create({ data: { name: 'Hladne predjedi', icon: '🥗', color: '#10b981', sortOrder: 0, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Tople predjedi', icon: '🍲', color: '#f97316', sortOrder: 1, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Juhe', icon: '🥣', color: '#a78bfa', sortOrder: 2, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Glavne jedi', icon: '🥩', color: '#ef4444', sortOrder: 3, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Testenine, njoki', icon: '🍝', color: '#eab308', sortOrder: 4, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Rižote', icon: '🍚', color: '#a3e635', sortOrder: 5, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Kalamari', icon: '🦑', color: '#6366f1', sortOrder: 6, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Ribje jedi', icon: '🐟', color: '#0ea5e9', sortOrder: 7, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Solate', icon: '🥬', color: '#22c55e', sortOrder: 8, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Pizze', icon: '🍕', color: '#8b5cf6', sortOrder: 9, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Burgerji', icon: '🍔', color: '#ec4899', sortOrder: 10, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Vegetarijanske jedi', icon: '🥦', color: '#14b8a6', sortOrder: 11, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Palačinke', icon: '🥞', color: '#f59e0b', sortOrder: 12, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Sladice', icon: '🍰', color: '#06b6d4', sortOrder: 13, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Otroške jedi', icon: '🧒', color: '#a78bfa', sortOrder: 14, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Malice', icon: '📋', color: '#059669', sortOrder: 15, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Priloge', icon: '🍟', color: '#84cc16', sortOrder: 16, menuId: foodMenu.id } }),
    db.category.create({ data: { name: 'Omake', icon: '🫙', color: '#dc2626', sortOrder: 17, menuId: foodMenu.id } }),
  ])

  const drinkCategories = await Promise.all([
    db.category.create({ data: { name: 'Penine in Šampanjci', icon: '🥂', color: '#f59e0b', sortOrder: 0, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Bela Vina', icon: '🥂', color: '#fbbf24', sortOrder: 1, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Rosé Vino', icon: '🌸', color: '#f472b6', sortOrder: 2, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Rdeča Vina', icon: '🍷', color: '#7c2d12', sortOrder: 3, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Tuja Vina', icon: '🌍', color: '#6366f1', sortOrder: 4, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Likersko Vino', icon: '🍷', color: '#a855f7', sortOrder: 5, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Točeno Pivo', icon: '🍺', color: '#d97706', sortOrder: 6, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Pivo', icon: '🍻', color: '#ea580c', sortOrder: 7, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Craft Piva', icon: '🍻', color: '#65a30d', sortOrder: 8, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Brezalkoholno Pivo', icon: '🍺', color: '#14b8a6', sortOrder: 9, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Viski', icon: '🥃', color: '#92400e', sortOrder: 10, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Gin', icon: '🍸', color: '#0ea5e9', sortOrder: 11, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Likerji', icon: '🍹', color: '#a855f7', sortOrder: 12, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Grenčice', icon: '🫒', color: '#4d7c0f', sortOrder: 13, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Destilati, Konjak in Rum', icon: '🥃', color: '#6b21a8', sortOrder: 14, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Topli Napitki', icon: '☕', color: '#92400e', sortOrder: 15, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Mešane Pijače', icon: '🍹', color: '#ec4899', sortOrder: 16, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Vode', icon: '💧', color: '#0ea5e9', sortOrder: 17, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Naravni Sokovi', icon: '🧃', color: '#84cc16', sortOrder: 18, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Sokovi', icon: '🧃', color: '#22c55e', sortOrder: 19, menuId: drinksMenu.id } }),
    db.category.create({ data: { name: 'Gazirane Pijače', icon: '🥤', color: '#ef4444', sortOrder: 20, menuId: drinksMenu.id } }),
  ])

  const [penine, belaVina, roseVino, rdecaVina, tujaVina, likerskoVino,
    tocenoPivo, pivo, craftPiva, brezalkPivo, viski, gin, likerji,
    grencice, destilati, topliNapitki, mesanePijace, vode, naravniSokovi, sokovi, gaziranePijace
  ] = drinkCategories

  return {
    foodMenu, drinksMenu,
    cats: { hladnePredjedi, toplePredjedi, juhe, glavneJedi, testenine, rizote, kalamari, ribjeJedi, solate, pizza, burgerji, vegetarijanske, palacinke, sladice, outroskeJedi, malice, priloge, omake, penine, belaVina, roseVino, rdecaVina, tujaVina, likerskoVino, tocenoPivo, pivo, craftPiva, brezalkPivo, viski, gin, likerji, grencice, destilati, topliNapitki, mesanePijace, vode, naravniSokovi, sokovi, gaziranePijace },
  }
}

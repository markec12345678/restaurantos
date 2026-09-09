import { db } from '@/lib/db'

// ============================================
// SEED: Modifier Groups
// ============================================
export async function seedModifierGroups() {
  // MODEL A (#9): skupine modifikatorjev so PO LOKACIJI — enaka resolucija
  // lokacije kot seedMenusAndCategories (prva aktivna, fallback loc-1).
  const firstLocation = await db.location.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  const locationId = firstLocation?.id || 'loc-1'
  const [cookingLevel, sideChoice, sauceChoice, cheeseChoice, milkChoice, sweetenerChoice, alcoholAdd, pizzaSize, burgerSize, iceChoice] = await Promise.all([
    db.modifierGroup.create({ data: { name: 'Način pečenja', locationId, required: true, minSelect: 1, maxSelect: 1, sortOrder: 0, modifiers: { create: [
      { name: 'Srednje redko', price: 0, sortOrder: 0 },
      { name: 'Srednje', price: 0, sortOrder: 1 },
      { name: 'Srednje pečeno', price: 0, sortOrder: 2 },
      { name: 'Dobro pečeno', price: 0, sortOrder: 3 },
    ] } } }),
    db.modifierGroup.create({ data: { name: 'Priloga', locationId, required: false, minSelect: 0, maxSelect: 2, sortOrder: 1, modifiers: { create: [
      { name: 'Pomfri', price: 0, sortOrder: 0 },
      { name: 'Pečen krompir', price: 0, sortOrder: 1 },
      { name: 'Solata', price: 0, sortOrder: 2 },
      { name: 'Zelenjavna priloga', price: 0, sortOrder: 3 },
      { name: 'Riž', price: 0, sortOrder: 4 },
    ] } } }),
    db.modifierGroup.create({ data: { name: 'Omaka', locationId, required: false, minSelect: 0, maxSelect: 1, sortOrder: 2, modifiers: { create: [
      { name: 'BBQ omaka', price: 0, sortOrder: 0 },
      { name: 'Česnova omaka', price: 0, sortOrder: 1 },
      { name: 'Gobična omaka', price: 1.50, sortOrder: 2 },
      { name: 'Pepper omaka', price: 1.50, sortOrder: 3 },
      { name: 'Tatarska omaka', price: 0, sortOrder: 4 },
    ] } } }),
    db.modifierGroup.create({ data: { name: 'Dodatni sir', locationId, required: false, minSelect: 0, maxSelect: 2, sortOrder: 3, modifiers: { create: [
      { name: 'Cheddar', price: 1.50, sortOrder: 0 },
      { name: 'Švicarski', price: 1.50, sortOrder: 1 },
      { name: 'Mocarela', price: 1.50, sortOrder: 2 },
      { name: 'Gorgonzola', price: 2.00, sortOrder: 3 },
    ] } } }),
    db.modifierGroup.create({ data: { name: 'Vrsta mleka', locationId, required: false, minSelect: 0, maxSelect: 1, sortOrder: 4, modifiers: { create: [
      { name: 'Kravje mleko', price: 0, sortOrder: 0 },
      { name: 'Ovseno mleko', price: 0.50, sortOrder: 1 },
      { name: 'Mandljevo mleko', price: 0.50, sortOrder: 2 },
      { name: 'Sojino mleko', price: 0.50, sortOrder: 3 },
    ] } } }),
    db.modifierGroup.create({ data: { name: 'Sladilo', locationId, required: false, minSelect: 0, maxSelect: 1, sortOrder: 5, modifiers: { create: [
      { name: 'Sladkor', price: 0, sortOrder: 0 },
      { name: 'Med', price: 0.30, sortOrder: 1 },
      { name: 'Stevia', price: 0.30, sortOrder: 2 },
    ] } } }),
    db.modifierGroup.create({ data: { name: 'Alkoholni dodatek', locationId, required: false, minSelect: 0, maxSelect: 1, sortOrder: 6, modifiers: { create: [
      { name: 'Amaretto', price: 2.50, sortOrder: 0 },
      { name: 'Baileys', price: 2.50, sortOrder: 1 },
      { name: 'Kahlua', price: 2.50, sortOrder: 2 },
    ] } } }),
    db.modifierGroup.create({ data: { name: 'Velikost', locationId, required: true, minSelect: 1, maxSelect: 1, sortOrder: 7, modifiers: { create: [
      { name: 'Mala (25cm)', price: 0, sortOrder: 0 },
      { name: 'Srednja (30cm)', price: 3.00, sortOrder: 1 },
      { name: 'Velika (35cm)', price: 5.00, sortOrder: 2 },
    ] } } }),
    db.modifierGroup.create({ data: { name: 'Velikost', locationId, required: true, minSelect: 1, maxSelect: 1, sortOrder: 8, modifiers: { create: [
      { name: 'Običajen (150g)', price: 0, sortOrder: 0 },
      { name: 'Velik (250g)', price: 3.50, sortOrder: 1 },
    ] } } }),
    db.modifierGroup.create({ data: { name: 'Led', locationId, required: false, minSelect: 0, maxSelect: 1, sortOrder: 9, modifiers: { create: [
      { name: 'Z ledom', price: 0, sortOrder: 0 },
      { name: 'Brez ledu', price: 0, sortOrder: 1 },
    ] } } }),
  ])

  return { cookingLevel, sideChoice, sauceChoice, cheeseChoice, milkChoice, sweetenerChoice, alcoholAdd, pizzaSize, burgerSize, iceChoice }
}

// Pomožne funkcije za AI QR upsell
// POST /api/ai/qr-upsell — pomožni modul za parjanja, kategorije in čas dneva

import { toNum } from '@/lib/decimal'

// ─── Tipi ───
export interface CartItem {
  menuItemId: string
  name: string
  category: string
  price: number
}

// ─── Čas dneva ───
export const HOUR_MAP: Record<string, { label: string; categories: string[] }> = {
  'morning':   { label: 'Zajtrk',   categories: ['Zajtrki', 'Kava', 'Vroče pijače', 'Sadni sokovi', 'Topla predjedi'] },
  'lunch':     { label: 'Kosilo',   categories: ['Juhe', 'Testenine', 'Rižote', 'Glavne jedi', 'Solate'] },
  'afternoon': { label: 'Popoldne', categories: ['Kava', 'Sladice', 'Koktajli', 'Prigrizki'] },
  'evening':   { label: 'Večerja',  categories: ['Predjedi', 'Glavne jedi', 'Jedi z žara', 'Vino', 'Koktajli'] },
  'night':     { label: 'Pozno',    categories: ['Koktajli', 'Pivo', 'Prigrizki', 'Burgerji'] },
}

export function getTimeOfDay(hour: number): string {
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

// ─── Klasična pravila parjanja (fallback brez AI-ja) ───
export const CLASSIC_PAIRINGS: Record<string, Array<{ name: string; reason: string }>> = {
  'beef': [
    { name: 'Cabernet Sauvignon', reason: 'Gosti ob tem steaku najraje naročijo kozarec Cabernet Sauvignona.' },
    { name: 'Malvazija', reason: 'Malvazija odlično poudari okus govedine.' },
  ],
  'fish': [
    { name: 'Sauvignon Blanc', reason: 'Sauvignonignon je klasika ob ribjih jedeh.' },
    { name: 'Rebula', reason: 'Rebula s primorskega je idealna spremljevalka rib.' },
  ],
  'pasta': [
    { name: 'Hišna solata', reason: 'Sveža solata je popolna dopolnitev testenin.' },
    { name: 'Merlot', reason: 'Merlot mehko dopolni paradižnikove omake.' },
  ],
  'pizza': [
    { name: 'Laški teran', reason: 'Teran in pica — slovenska klasika.' },
    { name: 'Coca Cola', reason: 'Osvježujoča Cola k pici vedno pristane.' },
  ],
  'burger': [
    { name: 'Pivo Union', reason: 'Hladno pivo in burger — nepogrešljiva kombinacija.' },
    { name: 'Pommes frites', reason: 'Krompirjev priloga k burgerju je must-have.' },
  ],
  'salad': [
    { name: 'Radenska', reason: 'Mineralna voda poobilno osveži ob solati.' },
    { name: 'Rizling', reason: 'Rizling lajša in dopolnjuje sveže okuse.' },
  ],
  'dessert': [
    { name: 'Kava espresso', reason: 'Espresso je zaključek vsakega sladkega obroka.' },
    { name: 'Tawny Port', reason: 'Sladki portugalec ojača okus sladice.' },
  ],
}

export function getCategoryType(catName: string): string {
  const lower = catName.toLowerCase()
  if (lower.includes('mesn') || lower.includes('steak') || lower.includes('glavn') || lower.includes('žar')) return 'beef'
  if (lower.includes('rib') || lower.includes('seafood') || lower.includes('losos')) return 'fish'
  if (lower.includes('testenin') || lower.includes('pasta') || lower.includes('njok') || lower.includes('rižot')) return 'pasta'
  if (lower.includes('pic')) return 'pizza'
  if (lower.includes('burger')) return 'burger'
  if (lower.includes('solat')) return 'salad'
  if (lower.includes('sladic') || lower.includes('dessert')) return 'dessert'
  return 'beef'
}

// ─── Tip za predlog ───
export interface PairingSuggestion {
  menuItemId: string
  name: string
  price: number
  category: string
  reason: string
  type: 'pairing' | 'time-of-day' | 'popular'
}

// ─── Pridobi klasične parjane predloge ───
export function getClassicPairingSuggestions(
  cartItems: CartItem[] | undefined,
  allItems: Array<{
    id: string
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    price: any
    category: { name: string } | null
    sortOrder: number
  }>,
): PairingSuggestion[] {
  const cartCategoryTypes = new Set<string>()
  const cartItemNames = new Set<string>()
  for (const item of cartItems || []) {
    cartCategoryTypes.add(getCategoryType(item.category || ''))
    cartItemNames.add(item.name)
  }

  const suggestions: PairingSuggestion[] = []

  // Pairing predlogi
  for (const catType of cartCategoryTypes) {
    const pairings = CLASSIC_PAIRINGS[catType] || []
    for (const pairing of pairings) {
      const found = allItems.find(i =>
        i.name.toLowerCase().includes(pairing.name.toLowerCase()) &&
        !cartItemNames.has(i.name)
      )
      if (found && found.category) {
        suggestions.push({
          menuItemId: found.id,
          name: found.name,
          price: toNum(found.price),
          category: found.category.name,
          reason: pairing.reason,
          type: 'pairing',
        })
      }
    }
  }

  return suggestions
}

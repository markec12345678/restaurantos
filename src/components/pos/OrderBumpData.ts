import type { UpsellItem, OrderBumpRule } from './order-bump/constants'

// ============================================
// HARDKODIRANI PODATKI — Upsell predlogi in pravila
// (V produkciji bi prihajali iz API-ja / baze)
// ============================================

export const DEFAULT_UPSELL_ITEMS: UpsellItem[] = [
  {
    id: 'dessert-upsell',
    name: 'Domaci štrudelj',
    price: 4.90,
    originalPrice: 5.90,
    category: 'Sladice',
    reason: 'Stranke, ki naročijo glavno jed, pogosto dodajo sladico',
    type: 'add-on',
    popularity: 78,
    margin: 72,
    imageEmoji: '🍰',
  },
  {
    id: 'wine-upgrade',
    name: 'Refošk Premium',
    price: 6.50,
    originalPrice: 8.50,
    category: 'Vina',
    reason: 'Nadgradnja na premium vino ob naročilu zrezka',
    type: 'upgrade',
    popularity: 45,
    margin: 80,
    imageEmoji: '🍷',
  },
  {
    id: 'side-combo',
    name: 'Pomfri + Solata',
    price: 3.90,
    category: 'Priloge',
    reason: 'Najbolj priljubljena kombinacija prilog',
    type: 'combo',
    popularity: 82,
    margin: 65,
    imageEmoji: '🍟',
  },
  {
    id: 'coffee-add',
    name: 'Espresso',
    price: 2.20,
    category: 'Kava',
    reason: 'Kava ob sladici poveča zadovoljstvo za 34%',
    type: 'add-on',
    popularity: 91,
    margin: 88,
    imageEmoji: '☕',
  },
  {
    id: 'soup-upgrade',
    name: 'Juha dneva + Predjedi',
    price: 5.90,
    originalPrice: 7.40,
    category: 'Predjedi',
    reason: 'Kombo predjedi poveča povprečni račun za 18%',
    type: 'combo',
    popularity: 56,
    margin: 70,
    imageEmoji: '🍲',
  },
  {
    id: 'kids-drink',
    name: 'Sok za otroke',
    price: 1.90,
    category: 'Otroški meni',
    reason: '75% otroških obrokov vključuje pijačo',
    type: 'side',
    popularity: 75,
    margin: 82,
    imageEmoji: '🧃',
  },
]

export const DEFAULT_BUMP_RULES: OrderBumpRule[] = [
  { id: 'r1', name: 'Sladica ob glavni jedi', trigger: 'Glavna jed > 10 EUR', suggestion: 'Dodaj sladico za 17% popust', type: 'add-on', discount: 17, enabled: true, conversionRate: 28, totalRevenue: 2450 },
  { id: 'r2', name: 'Premium vino ob zrezku', trigger: 'Zrezek v naročilu', suggestion: 'Nadgradnja na premium vino', type: 'upgrade', discount: 15, enabled: true, conversionRate: 18, totalRevenue: 1820 },
  { id: 'r3', name: 'Priloga kombo', trigger: 'Brez priloge', suggestion: 'Dodaj pomfri + solato za 3.90 EUR', type: 'combo', discount: 12, enabled: true, conversionRate: 34, totalRevenue: 3100 },
  { id: 'r4', name: 'Kava ob sladici', trigger: 'Sladica v naročilu', suggestion: 'Kava + sladica = popolna kombinacija', type: 'add-on', discount: 10, enabled: true, conversionRate: 42, totalRevenue: 1560 },
  { id: 'r5', name: 'Otroški sok', trigger: 'Otroški meni', suggestion: 'Dodaj sok za 1.90 EUR', type: 'side', discount: 0, enabled: true, conversionRate: 65, totalRevenue: 890 },
  { id: 'r6', name: 'Aperitiv ob čakanju', trigger: 'Čakanje > 15 min', suggestion: 'Aperitiv na popust med čakanjem', type: 'add-on', discount: 20, enabled: false, conversionRate: 22, totalRevenue: 560 },
]

// =====================================================================
// Konstante za spletno naročanje
// =====================================================================

export const ALLERGEN_DATA: Record<string, { label: string; icon: string }> = {
  '1': { label: 'Gluten', icon: '🌾' },
  '2': { label: 'Raki', icon: '🦐' },
  '3': { label: 'Jajca', icon: '🥚' },
  '4': { label: 'Ribe', icon: '🐟' },
  '5': { label: 'Arašidi', icon: '🥜' },
  '6': { label: 'Soja', icon: '🫘' },
  '7': { label: 'Mleko', icon: '🥛' },
  '8': { label: 'Oreški', icon: '🌰' },
  '9': { label: 'Zeler', icon: '🥬' },
  '10': { label: 'Gorčica', icon: '🟡' },
  '11': { label: 'Sezam', icon: '⚪' },
  '12': { label: 'Sulfiti', icon: '💨' },
  '13': { label: 'Volčji bob', icon: '🫘' },
  '14': { label: 'Mehkužci', icon: '🐚' },
}

export const DEFAULT_DELIVERY_FEE = 2.50
export const DEFAULT_MIN_ORDER = 10.00
export const ESTIMATED_DELIVERY_MIN = 30
export const ESTIMATED_TAKEOUT_MIN = 15

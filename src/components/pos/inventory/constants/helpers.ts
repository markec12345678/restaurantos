// ============================================
// POMOŽNE FUNKCIJE za upravljanje zalog
// ============================================

export const stockLevelColor = (quantity: number, minQuantity: number): 'destructive' | 'secondary' | 'default' => {
  if (quantity <= 0) return 'destructive'
  if (quantity <= minQuantity) return 'secondary'
  return 'default'
}

export const stockLevelText = (quantity: number, minQuantity: number): string => {
  if (quantity <= 0) return 'Ni na zalogi'
  if (quantity <= minQuantity * 0.5) return 'Kritično'
  if (quantity <= minQuantity) return 'Nizko'
  return 'Na zalogi'
}

export function formatDateTimeSI(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

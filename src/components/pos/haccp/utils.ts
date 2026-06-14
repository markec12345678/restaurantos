// ============================================
// POMOŽNE FUNKCIJE
// ============================================

export function formatDateSI(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

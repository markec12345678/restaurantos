// Izračun distribucije in ur za Tip Pool

import type { EmployeeEntry, Distribution } from './schemas'

// ─── Izračun distribucije ─────────────────────────────────────

export function calculateDistributions(
  method: 'equal' | 'hours' | 'points' | 'manual',
  employees: EmployeeEntry[],
  totalTips: number
): Distribution[] {
  let distributions: Distribution[] = []

  switch (method) {
    case 'equal': {
      const perPerson = totalTips / employees.length
      distributions = employees.map(e => ({ ...e, amount: Math.round(perPerson * 100) / 100 }))
      break
    }
    case 'hours': {
      const totalHours = employees.reduce((sum, e) => sum + e.hoursWorked, 0)
      distributions = employees.map(e => ({
        ...e,
        amount: totalHours > 0 ? Math.round((e.hoursWorked / totalHours) * totalTips * 100) / 100 : 0,
      }))
      break
    }
    case 'points': {
      const totalPoints = employees.reduce((sum, e) => sum + e.points, 0)
      distributions = employees.map(e => ({
        ...e,
        amount: totalPoints > 0 ? Math.round((e.points / totalPoints) * totalTips * 100) / 100 : 0,
      }))
      break
    }
    case 'manual': {
      distributions = employees.map(e => ({ ...e, amount: 0 }))
      break
    }
  }

  // Poravnaj razliko zaradi zaokroževanja
  const distributedTotal = distributions.reduce((sum, d) => sum + d.amount, 0)
  const diff = Math.round((totalTips - distributedTotal) * 100) / 100
  if (diff !== 0 && distributions.length > 0) {
    distributions[0].amount = Math.round((distributions[0].amount + diff) * 100) / 100
  }

  return distributions
}

// ─── Pomožna funkcija za izračun ur ───────────────────────────

// FIX BUG-8 MEDIUM: Podpora za nočne izmene (npr. 22:00–06:00)
export function calculateHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMin = (sh || 0) * 60 + (sm || 0)
  const endMin = (eh || 0) * 60 + (em || 0)
  let diff = endMin - startMin
  // FIX: Če je diff negativen, je izmena čez polnoč (npr. 22:00–06:00)
  if (diff < 0) diff += 24 * 60
  return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0
}

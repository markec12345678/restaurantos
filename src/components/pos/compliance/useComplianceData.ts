'use client'
// ============================================
// HOOK: Podatki in logika za skladnost s predpisi
// Izvleče nalaganje in izračune iz glavne komponente
// ============================================

import { useComplianceFetch } from './useComplianceFetch'
import { computeComplianceScore } from './constants'

export function useComplianceData() {
  const { items, loadCompliance } = useComplianceFetch()

  // Izračuni
  const compliantCount = items.filter(i => i.status === 'compliant').length
  const warningCount = items.filter(i => i.status === 'warning').length
  const nonCompliantCount = items.filter(i => i.status === 'non-compliant').length
  const pendingCount = items.filter(i => i.status === 'pending').length
  const complianceScore = computeComplianceScore(items)

  return {
    items,
    loadCompliance,
    compliantCount,
    warningCount,
    nonCompliantCount,
    pendingCount,
    complianceScore,
  }
}

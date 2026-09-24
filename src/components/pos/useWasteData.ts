'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/pin-login/usePinAuth'
import type { WasteEntry, WasteSummary } from './waste/constants'

// ============================================
// HOOK: Podatki o odpadkih — REALNI waste ledger (epic #115 §3, R119)
// ============================================
// R119: /api/waste vrne WasteRecord vrstice + pošten summary (odpad/COGS,
// COGS/prihodek). Prej je ta hook fabriciral podatke iz /api/expenses
// (modulo razlogi, sample vrstice, trdo kodiran wasteRate 3.8).

interface WasteApiResponse {
  entries: WasteEntry[]
  summary: WasteSummary
  period: { from: string; to: string }
}

export function useWasteData(period: 'week' | 'month' | 'quarter') {
  const [entries, setEntries] = useState<WasteEntry[]>([])
  const [summary, setSummary] = useState<WasteSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      let periodStart: Date
      switch (period) {
        case 'week':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
          break
        case 'quarter':
          {
            const q = Math.floor(now.getMonth() / 3)
            periodStart = new Date(now.getFullYear(), q * 3, 1)
          }
          break
        case 'month':
        default:
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
          break
      }

      const res = await authFetch(
        `/api/waste?from=${encodeURIComponent(periodStart.toISOString())}&to=${encodeURIComponent(now.toISOString())}`,
      )
      if (!res.ok) {
        toast.error('Napaka pri nalaganju odpadkov')
        return
      }
      const data = (await res.json()) as WasteApiResponse
      setEntries(data.entries ?? [])
      setSummary(data.summary ?? null)
    } catch {
      toast.error('Napaka pri nalaganju odpadkov')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return { entries, summary, loading, refresh: loadData }
}

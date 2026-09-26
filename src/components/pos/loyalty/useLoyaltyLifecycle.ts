'use client'
// ============================================
// R143-c (epic #115 #30) — Hook: življenjski cikel zvestobe
// GET /api/loyalty/lifecycle (kontrakt R143-b: totals/byTier/
// lifecycleBuckets/expiringSoon30d/topAccounts + generatedAt, no-store,
// PII whitelist — topAccounts NIKOLI ne vsebuje telefona/e-pošte).
// Pariteta useDevices.ts / useLoyaltyQueries.ts kanonu:
// TanStack Query + authFetch (PinLogin re-export) + queryKeys barrel.
// Odgovor je EN agregat — sekcije z nevtralnimi fallbacki rešuje
// strežnik (R143-b); UI ločuje samo loading/error/data.
// ============================================

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { TierProgress } from '@/lib/loyalty-tiers'

// --- Tipi (zrcalijo odgovor GET /api/loyalty/lifecycle — brez `any`) ---

export interface LifecycleTotals {
  /** Aktivni računi (isActive) v scope-u */
  active: number
  /** Aktivni računi brez transakcije v zadnjih 60 dneh (WINBACK pariteta) */
  inactive60d: number
}

export interface LifecycleByTier {
  bronze: number
  silver: number
  gold: number
  platinum: number
}

export interface LifecycleBuckets {
  new: number
  active: number
  at_risk: number
  churned: number
}

export interface LifecycleExpiring {
  /** FIFO približek točk, ki potečejo v 30 dneh */
  points: number
  accounts: number
  capped: boolean
  /** Št. prebranih računov (pošten obseg izračuna) */
  scanned: number
}

/** Vrstica top računov — whitelist kontrakt R143-b (BREZ PII polj). */
export interface LifecycleTopAccount {
  id: string
  customerName: string
  tier: string
  pointsBalance: number
  lifetimePoints: number
  /** Napredek do naslednjega nivoja (kanon lib/loyalty-tiers.tierProgress) */
  tierProgress: TierProgress
}

export interface LifecycleData {
  totals: LifecycleTotals
  byTier: LifecycleByTier
  lifecycleBuckets: LifecycleBuckets
  expiringSoon30d: LifecycleExpiring
  topAccounts: LifecycleTopAccount[]
  /** ISO timestamp generiranja odgovora (UI: 'Posodobljeno: …') */
  generatedAt: string
}

export const LIFECYCLE_ERROR_MESSAGE = 'Življenjskega cikla zvestobe ni bilo mogoče naložiti.'

export function useLoyaltyLifecycle() {
  return useQuery<LifecycleData>({
    queryKey: queryKeys.loyalty.lifecycle(),
    queryFn: async (): Promise<LifecycleData> => {
      const res = await authFetch('/api/loyalty/lifecycle')
      if (!res.ok) {
        throw new Error(LIFECYCLE_ERROR_MESSAGE)
      }
      return (await res.json()) as LifecycleData
    },
    // Pregled, ne živi feed — 60 s svežine, blago pollanje 2 min (kontrakt R143-c).
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  })
}

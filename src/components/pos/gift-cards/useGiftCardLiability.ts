'use client'
// ============================================
// R144-c (epic #115 #31) — Hook: pasivna obveznost darilnih kartic
// GET /api/gift-cards/liability (kontrakt R144-b: totals/byLocation/
// generatedAt, no-store, view_reports + tenant scope).
// Pariteta useLoyaltyLifecycle.ts (R143-c) kanonu:
// TanStack Query + authFetch (PinLogin re-export) + queryKeys barrel.
// Odgovor je EN agregat — deepToNumbers-čist (vse številke JS numbers).
//
// PII kanon: odgovor vsebuje SAMO agregate (imena/kode lokacij + števci +
// saldi) — NIKOLI cardNumber/ownerName/e-pošte; tipi ne deklarirajo takih
// polj, render jih ne more izrisati (no-fabrication kanon).
// ============================================

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

// --- Tipi (zrcalijo odgovor GET /api/gift-cards/liability 1:1 — brez `any`) ---

/** expiringSoon30d — status active IN expiresAt ≤ now + GIFT_CARD_EXPIRING_SOON_DAYS dni. */
export interface LiabilityExpiringSoon {
  cards: number
  balance: number
}

export interface LiabilityTotals {
  /** Σ balance nad statusi active + depleted (denar, ki ga gostje še lahko potrošijo) */
  outstandingBalance: number
  activeCards: number
  depletedCards: number
  /** Števec — NE šteje se v outstandingBalance (zamrznjen saldo) */
  suspendedCards: number
  /** Števec — NE šteje se v outstandingBalance (odpisan saldo) */
  expiredCards: number
  expiringSoon30d: LiabilityExpiringSoon
}

/** Vrstica per lokacijo — locationId null = 'Brez lokacije' bucket (server ga uredi zadnjega). */
export interface LiabilityByLocationRow {
  locationId: string | null
  locationName: string
  locationCode: string | null
  outstandingBalance: number
  activeCards: number
  depletedCards: number
  suspendedCards: number
  expiredCards: number
}

export interface LiabilityData {
  totals: LiabilityTotals
  byLocation: LiabilityByLocationRow[]
  /** ISO timestamp generiranja odgovora (UI: 'Posodobljeno: …') */
  generatedAt: string
}

export const GIFT_CARD_LIABILITY_ERROR_MESSAGE =
  'Odpustne obveznosti darilnih kartic ni bilo mogoče naložiti.'

export function useGiftCardLiability() {
  return useQuery<LiabilityData>({
    queryKey: queryKeys.giftCards.liability(),
    queryFn: async (): Promise<LiabilityData> => {
      const res = await authFetch('/api/gift-cards/liability')
      if (!res.ok) {
        throw new Error(GIFT_CARD_LIABILITY_ERROR_MESSAGE)
      }
      return (await res.json()) as LiabilityData
    },
    // Pregled, ne živi feed — 60 s svežine, blago pollanje 2 min (kontrakt R144-c).
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  })
}

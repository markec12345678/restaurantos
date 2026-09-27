'use client'

// ============================================
// R145-c (epic #115 #32) — useTipPoolPayout
// Izplačilna mutacija za tip pool (POST /api/tip-pool/[id]/payout, brez
// bodyja — kontrakt R145-b). Strežnik vrača POLN pool z distribucijami
// (PUT pariteta, deepToNumbers) + DODATNO payoutSummary
// { distributionCount, totalPaid }.
//
// Kanoni:
//  - napake: povrži TOČNO strežnikovo sporočilo (body.error) — 400
//    'Distribucija še ni shranjena', 409 'Tip pool je že izplačan',
//    404 'Tipski bazen ni najden' (R143/R144 kanon, useGiftCardMutations).
//  - uspeh: toast 'Napitnine izplačane' s povzetkom izplačila + invalidacija
//    ENOTNEGA korena queryKeys.tipPool.all (['tip-pools']) — pokrije listing
//    IN byDate (R145-c unifikacija, glej payments-loyalty-config.ts).
//  - UI pokaže 'Izplačaj' SAMO za status 'distributed' (state machine pariteta
//    s payout-handlerjem R145-b; dead buttons so prepovedani).
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { formatEUR } from '@/lib/safe-format'
import type { TipPoolData } from './constants'

/** Povzetek izplačila — aditivno polje strežniškega odgovora (R145-b). */
export interface TipPayoutSummary {
  distributionCount: number
  totalPaid: number
}

/**
 * Odgovor POST /api/tip-pool/[id]/payout — poln pool z distribucijami
 * (kontrakt 1:1 z TipPoolData) + aditivni payoutSummary. Brez `any`.
 */
export interface TipPayoutResponse extends TipPoolData {
  payoutSummary: TipPayoutSummary
}

/**
 * Izplačaj distribuiran tip pool. `onSuccess` (opcijsko) je za lokalno UI
 * stanje (npr. zapri confirm dialog) — toast + invalidacija so tu, v hooku
 * (useGiftCardMutations precedens).
 */
export function useTipPoolPayout(onSuccess?: (data: TipPayoutResponse) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tipPoolId: string): Promise<TipPayoutResponse> => {
      // NO body — kontrakt R145-b (pool je identifikiran z URL potjo)
      const res = await authFetch(`/api/tip-pool/${encodeURIComponent(tipPoolId)}/payout`, {
        method: 'POST',
      })
      if (!res.ok) {
        // R143/R144 kanon: povrži točno strežnikovo sporočilo (400/409/404),
        // da uporabnik vidi resnični vzrok namesto generične napake.
        let message = 'Napaka pri izplačilu napitnin'
        try {
          const body = (await res.json()) as { error?: string }
          if (body?.error) message = body.error
        } catch {
          // body ni JSON — obdrži generično sporočilo
        }
        throw new Error(message)
      }
      return res.json()
    },
    onSuccess: (data) => {
      const summary = data.payoutSummary
      toast.success(
        `Napitnine izplačane · Izplačanih distribucij: ${summary.distributionCount} · Skupaj: ${formatEUR(summary.totalPaid)}`,
      )
      // ENOTEN koren (R145-c unifikacija): ['tip-pools'] hierarhično pokrije
      // listing (['tip-pools']) IN byDate (['tip-pools', date]).
      queryClient.invalidateQueries({ queryKey: queryKeys.tipPool.all })
      onSuccess?.(data)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Napaka pri izplačilu napitnin')
    },
  })
}

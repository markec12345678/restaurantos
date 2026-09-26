'use client'
// ============================================
// R141-c (epic #115 P2-28) — Hook: podatki dnevnega pregleda
// EN agregatni endpoint GET /api/reports/briefing?date=YYYY-MM-DD
// (kontrakt R141-b). Pariteta useFeedbackData.ts / Dashboard kanonu:
// TanStack Query + authFetch (PinLogin re-export) + queryKeys.
// ============================================

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
// R141-c: briefingKeys živi v inventory-cash-reports.ts (subpath import —
// barrel index.ts v tej rundi NI na seznamu dotakljivih datotek; R141-final
// lahko po želji doda `briefing: briefingKeys` v queryKeys barrel).
import { briefingKeys } from '@/lib/query-keys/inventory-cash-reports'
import { ljubljanaTodayStr } from '@/lib/timezone-sl'
import type { BriefingResponse } from './constants'

export const BRIEFING_ERROR_MESSAGE = 'Pregleda dneva ni bilo mogoče naložiti.'

export function useBriefing() {
  // Poslovni datum v Ljubljani (P2-08 kanon — NE UTC toISOString split).
  // Izračun enkrat na mount; osvežitev z istim dnevom = isti queryKey.
  const date = ljubljanaTodayStr()

  const query = useQuery({
    queryKey: briefingKeys.all,
    queryFn: async (): Promise<BriefingResponse> => {
      const res = await authFetch(`/api/reports/briefing?date=${date}`)
      if (!res.ok) {
        throw new Error(BRIEFING_ERROR_MESSAGE)
      }
      return (await res.json()) as BriefingResponse
    },
    staleTime: 60_000,
    retry: 1,
  })

  return { ...query, date }
}

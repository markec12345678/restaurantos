'use client'

// ============================================
// HOOK: Dnevni zaključek (R126-b, P0-02) — poizvedbe in mutacije
// Endpointi (kontrakt R126-a):
//   GET/POST  /api/daily-close
//   POST      /api/daily-close/[id]/approve | /reject | /reopen
// Napake: { error, openShifts? } — authFetch { error } pretvori v Error.message
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type {
  DailyCloseActionInput,
  DailyCloseData,
  DailyCloseDayInput,
  DailyClosePostResult,
  DailyCloseRow,
} from './constants'

/** Slovenjska sporočila za znane 409 kode API-ja; neznane → surovo { error } sporočilo */
const DAILY_CLOSE_ERROR_LABELS: Record<string, string> = {
  DAILY_CLOSE_ALREADY_CLOSED: 'Ta dan je že zaključen — ponovni zaključek zahteva predhodno ponovno odpiranje.',
  DAILY_CLOSE_NOT_PENDING: 'Zaključek ni več v čakanju odobritve.',
  DAILY_CLOSE_NOT_CLOSED: 'Dan ni zaključen — ponovno odpiranje ni mogoče.',
  OPEN_SHIFTS: 'Zaključek zavrnjen — obstajajo odprte izmene. Zaprite jih in poskusite znova.',
  Z_REPORT_CONFLICT: 'Konflikt Z-poročila — osvežite podatke in poskusite znova.',
}

/** { error } iz API-ja → slovensko sporočilo (znane kode preslikaj, neznane pokaži takšne, kot so) */
export function describeDailyCloseError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    for (const [code, label] of Object.entries(DAILY_CLOSE_ERROR_LABELS)) {
      if (error.message.includes(code)) return label
    }
    return error.message
  }
  return fallback
}

/** Invalidacija po vsaki mutaciji — dnevni zaključek, EOD pregled, dashboard, Z-poročila */
function invalidateDailyCloseCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.dailyClose.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.endOfDay.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.zReport.all })
}

/**
 * Dnevni zaključek — seznam.
 *   useDailyClose(date) → GET /api/daily-close?date=YYYY-MM-DD  (zapis izbranega dne)
 *   useDailyClose()     → GET /api/daily-close                  (zadnjih 60 — zgodovina)
 */
export function useDailyClose(date?: string) {
  return useQuery<DailyCloseData>({
    queryKey: queryKeys.dailyClose.list(date ? { date } : { scope: 'recent' }),
    queryFn: async () => {
      const res = await authFetch(
        date ? `/api/daily-close?date=${encodeURIComponent(date)}` : '/api/daily-close',
      )
      return (await res.json()) as DailyCloseData
    },
  })
}

/** Zaključi dan → POST /api/daily-close { date, countedCash, notes?, idempotencyKey } */
export function useCloseDay() {
  const queryClient = useQueryClient()
  return useMutation<DailyClosePostResult, Error, DailyCloseDayInput>({
    mutationFn: async (input) => {
      const res = await authFetch('/api/daily-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: input.date,
          countedCash: input.countedCash,
          notes: input.notes && input.notes.trim() !== '' ? input.notes.trim() : undefined,
          idempotencyKey: input.idempotencyKey,
        }),
      })
      return (await res.json()) as DailyClosePostResult
    },
    onSuccess: (result) => {
      invalidateDailyCloseCaches(queryClient)
      toast.success(
        result.requiresApproval
          ? 'Poslano v odobritev — denarna razlika presega prag'
          : 'Dan zaključen — dnevni zaključek shranjen',
      )
    },
    onError: (error) => toast.error(describeDailyCloseError(error, 'Napaka pri zaključku dneva')),
  })
}

/** Odobri čakajoči zaključek → POST /api/daily-close/[id]/approve (admin) */
export function useApproveDailyClose() {
  const queryClient = useQueryClient()
  return useMutation<{ close: DailyCloseRow }, Error, Pick<DailyCloseActionInput, 'id'>>({
    mutationFn: async ({ id }) => {
      const res = await authFetch(`/api/daily-close/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      return (await res.json()) as { close: DailyCloseRow }
    },
    onSuccess: () => {
      invalidateDailyCloseCaches(queryClient)
      toast.success('Dnevni zaključek odobren — dan zaključen')
    },
    onError: (error) => toast.error(describeDailyCloseError(error, 'Napaka pri odobritvi dnevnega zaključka')),
  })
}

/** Zavrni čakajoči zaključek → POST /api/daily-close/[id]/reject { rejectedNote } (admin) */
export function useRejectDailyClose() {
  const queryClient = useQueryClient()
  return useMutation<{ close: DailyCloseRow }, Error, Pick<DailyCloseActionInput, 'id' | 'rejectedNote'>>({
    mutationFn: async ({ id, rejectedNote }) => {
      const res = await authFetch(`/api/daily-close/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // shematsko polje je rejectNote — pošljem obe imeni (Zod stripne neznane ključe)
        body: JSON.stringify({ rejectedNote: rejectedNote ?? '', rejectNote: rejectedNote ?? '' }),
      })
      return (await res.json()) as { close: DailyCloseRow }
    },
    onSuccess: () => {
      invalidateDailyCloseCaches(queryClient)
      toast.success('Zaključek zavrnjen — dan je ponovno odprt')
    },
    onError: (error) => toast.error(describeDailyCloseError(error, 'Napaka pri zavrnitvi dnevnega zaključka')),
  })
}

/** Ponovno odpri zaključen dan → POST /api/daily-close/[id]/reopen (admin) */
export function useReopenDailyClose() {
  const queryClient = useQueryClient()
  return useMutation<{ close: DailyCloseRow }, Error, Pick<DailyCloseActionInput, 'id' | 'reopenReason'>>({
    mutationFn: async ({ id, reopenReason }) => {
      const res = await authFetch(`/api/daily-close/${encodeURIComponent(id)}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // kontrakt R126-schema omenja `reason` — pošljem obe imeni (Zod stripne neznane ključe)
        body: JSON.stringify({ reopenReason: reopenReason ?? '', reason: reopenReason ?? '' }),
      })
      return (await res.json()) as { close: DailyCloseRow }
    },
    onSuccess: () => {
      invalidateDailyCloseCaches(queryClient)
      toast.success('Dan je ponovno odprt — Z-poročilo je v osnutku')
    },
    onError: (error) => toast.error(describeDailyCloseError(error, 'Napaka pri ponovnem odpiranju dneva')),
  })
}

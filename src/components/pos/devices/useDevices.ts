'use client'
// ============================================
// R142-c (epic #115 #29) — Hook: inventar naprav (Device center)
// GET /api/devices (kontrakt R142-b: whitelist + isOnline computed, no-store)
// + mutaciji rename/reassign (PATCH /api/devices/[id], admin auth).
// Pariteta useBriefing.ts / useLoyaltyMutations.ts kanonu:
// TanStack Query + authFetch (PinLogin re-export) + queryKeys + sonner toast.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { devicesKeys } from '@/lib/query-keys/devices'
import type { DeviceRow, DevicesResponse } from './constants'

export const DEVICES_ERROR_MESSAGE = 'Seznama naprav ni bilo mogoče naložiti.'

export function useDevices() {
  return useQuery({
    queryKey: devicesKeys.all,
    queryFn: async (): Promise<DevicesResponse> => {
      const res = await authFetch('/api/devices')
      if (!res.ok) {
        throw new Error(DEVICES_ERROR_MESSAGE)
      }
      return (await res.json()) as DevicesResponse
    },
    staleTime: 30_000,
    // Naprave so živi podatki (heartbeat vs. 5-min online pravilnik) —
    // blago pollanje 45 s (R142-a priporočilo 30–60 s).
    refetchInterval: 45_000,
    retry: 1,
  })
}

/** Skupna mutacijska logika: PATCH + invalidacija + toast (pariteta loyalty) */
function useDevicePatchMutation(successMessage: string, fallbackError: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { name?: string; locationId?: string } }) => {
      const res = await authFetch(`/api/devices/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        // authFetch vrže s sporočilom telesa; tu ročno za determinističen toast
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errBody?.error || fallbackError)
      }
      return (await res.json()) as { device: DeviceRow }
    },
    onSuccess: () => {
      toast.success(successMessage)
      queryClient.invalidateQueries({ queryKey: devicesKeys.all })
    },
    onError: (e: Error) => {
      toast.error(e.message || fallbackError)
    },
  })
}

/** Preimenovanje naprave (PATCH { name }) — admin */
export function useRenameDevice() {
  return useDevicePatchMutation('Naprava preimenovana', 'Preimenovanje naprave ni uspelo')
}

/** Prerazporeditev naprave na lokacijo (PATCH { locationId }) — izključno super-admin */
export function useReassignDevice() {
  return useDevicePatchMutation('Naprava prerazporejena', 'Prerazporeditev naprave ni uspela')
}

// --- Lokacije za prerazporeditev (samo super-admin; počasen fetch ob odprtju) ---

export interface ReassignLocationOption {
  id: string
  name: string
  isActive: boolean
}

/**
 * Aktivne lokacije za izbiro cilja prerazporeditve. GET /api/locations vrača
 * { locations, stats } (ali gole polje po starem — normalizacija po vzorcu
 * useLocationQueries). `enabled` samo ko je dialog odprt → brez odvečnih klicev.
 */
export function useActiveLocations(enabled: boolean) {
  return useQuery({
    queryKey: ['devices', 'reassign-locations'] as const,
    queryFn: async (): Promise<ReassignLocationOption[]> => {
      const res = await authFetch('/api/locations')
      if (!res.ok) return []
      const json = await res.json()
      const rows: Array<Record<string, unknown>> = Array.isArray(json)
        ? json
        : (json?.locations ?? [])
      return rows
        .map((r) => ({
          id: String(r.id ?? ''),
          name: String(r.name ?? ''),
          isActive: r.isActive !== false,
        }))
        .filter((r) => r.id && r.name)
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}

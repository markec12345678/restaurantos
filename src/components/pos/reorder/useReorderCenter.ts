'use client'

// ============================================
// R129 (epic #115 P1-07) — HOOK: Center naročil
// - GET /api/inventory/reorder  → predlogi (DELJEN cache z AI napovedjo,
//   queryKeys.inventory.reorder; normalizacija v `select` → cache ohrani
//   surovo obliko, zato useAIForecast ostane nespremenjen)
// - POST /api/reorder/draft-po { itemIds } → osnutki naročilnic (R129-server)
// - izbira artiklov + ocenjena vrednost + invalidacija PO/reorder ključev
// Vsi NOVI odgovorni polji so dostopani defenzivno (glej helpers.ts).
// ============================================

import { useMemo, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import {
  normalizeSuggestion,
  filterActionable,
  sortByUrgency,
  summarizeStatuses,
  groupEstimatedValue,
  formatSuggestionNote,
  type ReorderCenterSuggestion,
  type RawReorderSuggestion,
  type RawDraftPoPackItem,
} from './helpers'

export interface DraftPoOrder {
  id: string
  poNumber: string
  supplierName: string
  itemCount: number
  totalAmount: number
  expectedDate?: string | null
  /** R131 (P1-13): pack povzetek vrstic — ADDITIVNO, lahko manjka (stari odgovor) */
  items?: RawDraftPoPackItem[]
}

export interface DraftPoSkipped {
  itemId: string
  name?: string
  reason?: string
}

interface DraftPoResponse {
  orders?: DraftPoOrder[]
  skipped?: DraftPoSkipped[]
  error?: string
  code?: string
  items?: string[]
}

/** Tipizirana napaka POST /api/reorder/draft-po (SUPPLIER_MISSING / INVALID_INPUT / GENERIC) */
export class DraftPoError extends Error {
  kind: 'SUPPLIER_MISSING' | 'INVALID_INPUT' | 'GENERIC'
  items: string[]
  constructor(kind: 'SUPPLIER_MISSING' | 'INVALID_INPUT' | 'GENERIC', message: string, items: string[] = []) {
    super(message)
    this.name = 'DraftPoError'
    this.kind = kind
    this.items = items
  }
}

// enak ritem osveževanja kot useAIForecast (refetchInterval 60s)
const REFETCH_MS = 60000

export function useReorderCenter() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastDraft, setLastDraft] = useState<{ orders: DraftPoOrder[]; skipped: DraftPoSkipped[] } | null>(null)

  // Predlogi naročanja — deljena poizvedba z AI napovedjo (isti queryKey)
  const query = useQuery({
    queryKey: queryKeys.inventory.reorder,
    queryFn: async () => {
      const res = await authFetch('/api/inventory/reorder')
      if (!res.ok) throw new Error(`Napaka pri nalaganju predlogov (${res.status})`)
      return res.json() as Promise<{ summary?: Record<string, unknown>; suggestions?: RawReorderSuggestion[] }>
    },
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    // Normalizacija v select: cache ostane v surovi obliki (združljivo z useAIForecast),
    // Center naročil dobi normalizirane + po nujnosti sortirane predloge.
    select: (raw) => ({
      suggestions: sortByUrgency((raw?.suggestions ?? []).map(normalizeSuggestion)),
      summary: raw?.summary ?? {},
    }),
  })

  const suggestions = useMemo<ReorderCenterSuggestion[]>(() => query.data?.suggestions ?? [], [query.data])
  const actionable = useMemo(() => filterActionable(suggestions), [suggestions])
  const summary = useMemo(() => summarizeStatuses(suggestions), [suggestions])

  const toggleItem = useCallback((itemId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  // "Izberi vse nizke" — izbere VSE akcijske (nizke + kritične, brez pokritih z NO)
  const selectAllActionable = useCallback(() => {
    setSelected(new Set(actionable.map(s => s.itemId)))
  }, [actionable])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const selectedItems = useMemo(
    () => suggestions.filter(s => selected.has(s.itemId)),
    [suggestions, selected],
  )
  const estimatedTotal = useMemo(() => groupEstimatedValue(selectedItems), [selectedItems])

  // POST /api/reorder/draft-po — osnutki naročilnic po dobaviteljih (strežniška združitev)
  const draftMutation = useMutation({
    mutationFn: async (itemIds: string[]): Promise<DraftPoResponse> => {
      const res = await authFetch('/api/reorder/draft-po', {
        method: 'POST',
        body: JSON.stringify({ itemIds }),
      })
      // odgovor je lahko prazen/pokvarjen — ne sme povzročiti neulovljene napake
      const body = (await res.json().catch(() => ({}))) as DraftPoResponse
      if (!res.ok) {
        const code = body?.code ?? body?.error
        // SUPPLIER_MISSING: { error, items: string[] } — kodiramo defenzivno
        // (poznan `code`/`error` ALI prisotna neprazna `items` lista)
        if (code === 'SUPPLIER_MISSING' || (Array.isArray(body?.items) && body.items.length > 0)) {
          throw new DraftPoError('SUPPLIER_MISSING', body?.error || 'Manjkajoč dobavitelj', body?.items ?? [])
        }
        throw new DraftPoError(
          code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'GENERIC',
          body?.error || `Napaka pri ustvarjanju osnutka naročilnic (${res.status})`,
        )
      }
      return body
    },
    onSuccess: (body) => {
      const orders = body?.orders ?? []
      const skipped = body?.skipped ?? []
      setLastDraft({ orders, skipped })
      if (orders.length > 0) {
        toast.success(`Ustvarjen(os) osnutek(i) naročilnic: ${orders.map(o => o.poNumber).join(', ')}`)
      }
      if (skipped.length > 0) {
        toast.info(formatSuggestionNote(skipped))
      }
      if (orders.length === 0 && skipped.length === 0) {
        toast.error('Strežnik ni vrnil osnutkov naročilnic')
      }
      // invalidacija: seznami naročilnic + reorder predlogi (aktivna useQuery sama refetcha)
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.reorder })
      setSelected(new Set())
    },
    onError: (error: unknown) => {
      if (error instanceof DraftPoError && error.kind === 'SUPPLIER_MISSING') {
        toast.error(`Dobavitelj manjka za artikle: ${error.items.join(', ')}`)
        return
      }
      toast.error(error instanceof Error ? error.message : 'Napaka pri ustvarjanju osnutka naročilnic')
    },
  })

  const createDraft = useCallback(() => {
    if (selected.size === 0) {
      toast.error('Izberite vsaj en artikel')
      return
    }
    setLastDraft(null)
    draftMutation.mutate(Array.from(selected))
  }, [selected, draftMutation])

  return {
    suggestions,
    actionable,
    summary,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
    selected,
    selectedCount: selected.size,
    selectedItems,
    estimatedTotal,
    toggleItem,
    selectAllActionable,
    clearSelection,
    createDraft,
    isCreating: draftMutation.isPending,
    lastDraft,
  }
}

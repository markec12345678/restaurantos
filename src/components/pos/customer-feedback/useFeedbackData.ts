'use client'
// ============================================
// HOOK: Podatki za povratne informacije gostov
// Poizvedbe, mutacije in stanje
// Izvlečeno iz CustomerFeedback.tsx
// ============================================

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import {
  emptyFeedbackForm,
  parseFeedbackTags,
} from './constants'
import type {
  FeedbackEntry,
  FeedbackStatusFilter,
  NewFeedbackForm,
  AvgRatings,
  RatingDistributionItem,
} from './constants'

/** Telo PATCH zahtevka (R140-b kontrakt): status + opcijski response 1..1000 */
export interface UpdateFeedbackInput {
  id: string
  status: 'in_review' | 'resolved'
  response?: string
}

export function useFeedbackData() {
  const queryClient = useQueryClient()
  const [_tab, _setTab] = useState<'overview' | 'list' | 'new'>('overview')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [filterRating, setFilterRating] = useState('all')
  // P1-14 (R140-c): status filter — lokalni state (pariteta filterRating;
  // GET nima ?status — klient-side filtriranje po r140-b)
  const [filterStatus, setFilterStatus] = useState<FeedbackStatusFilter>('all')
  const [_selectedFeedback, _setSelectedFeedback] = useState<FeedbackEntry | null>(null)
  const [newFeedback, setNewFeedback] = useState<NewFeedbackForm>(emptyFeedbackForm())
  // P1-14 (R140-c): dialog 'Odgovori in reši' — tarča + osnutek odgovora
  const [resolveTarget, setResolveTarget] = useState<FeedbackEntry | null>(null)
  const [responseText, setResponseText] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.feedback.all,
    queryFn: async () => {
      const res = await authFetch('/api/guests/feedback')
      if (!res.ok) {
        return { feedbacks: [], stats: { avgRating: 0, total: 0, nps: 0 } }
      }
      const json = (await res.json()) as { feedbacks?: FeedbackEntry[]; stats?: { avgRating: number; total: number; nps: number } }
      // P1-14 (R140-c): tags pride iz GET-a kot JSON String ("[]") — normaliziraj
      // na tabelo (prej bi fb.tags.map v FeedbackCard-u crashal ob stringu);
      // nova polja (status/tableNumber/orderRef/resolved*) so v FeedbackEntry
      // tipu in tečejo passthrough prek spreta.
      const feedbacks: FeedbackEntry[] = (json.feedbacks ?? []).map(fb => ({
        ...fb,
        tags: parseFeedbackTags(fb.tags),
      }))
      return { ...json, feedbacks }
    },
  })

  const feedbacks: FeedbackEntry[] = data?.feedbacks || []
  const _stats = data?.stats || { avgRating: 0, total: 0, nps: 0 }

  const filteredFeedbacks = useMemo(() => {
    const rating = filterRating === 'all' ? null : parseInt(filterRating)
    return feedbacks.filter((f: FeedbackEntry) => {
      if (rating !== null && f.overallRating !== rating) return false
      // P1-14: status filter — manjkajoče polje obravnavaj kot 'new' (DB default)
      if (filterStatus !== 'all' && (f.status ?? 'new') !== filterStatus) return false
      return true
    })
  }, [feedbacks, filterRating, filterStatus])

  const avgRatings: AvgRatings = useMemo(() => {
    if (feedbacks.length === 0) return { overall: 0, food: 0, service: 0, atmosphere: 0 }
    return {
      overall: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.overallRating, 0) / feedbacks.length,
      food: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.foodRating, 0) / feedbacks.length,
      service: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.serviceRating, 0) / feedbacks.length,
      atmosphere: feedbacks.reduce((s: number, f: FeedbackEntry) => s + f.atmosphereRating, 0) / feedbacks.length,
    }
  }, [feedbacks])

  const ratingDistribution: RatingDistributionItem[] = useMemo(() => {
    return [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: feedbacks.filter((f: FeedbackEntry) => f.overallRating === rating).length,
    }))
  }, [feedbacks])

  const nps = useMemo(() => {
    if (feedbacks.length === 0) return 0
    const promoters = feedbacks.filter((f: FeedbackEntry) => f.overallRating >= 4).length
    const detractors = feedbacks.filter((f: FeedbackEntry) => f.overallRating <= 2).length
    return Math.round(((promoters - detractors) / feedbacks.length) * 100)
  }, [feedbacks])

  const createFeedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/guests/feedback', {
        method: 'POST',
        body: JSON.stringify(newFeedback),
      })
      if (!res.ok) throw new Error('Failed to create feedback')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Povratna informacija shranjena!')
      setShowNewDialog(false)
      setNewFeedback(emptyFeedbackForm())
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback.all })
    },
    onError: () => {
      toast.error('Napaka pri shranjevanju povratne informacije')
    },
  })

  // ─── P1-14 (R140-c): handlerji dialoga 'Odgovori in reši' (pure setState —
  //     definirani pred mutacijo, ki ju uporablja v callbackih) ───
  const openResolveDialog = (fb: FeedbackEntry) => {
    setResolveTarget(fb)
    setResponseText('')
  }
  const closeResolveDialog = () => {
    setResolveTarget(null)
    setResponseText('')
  }

  // ─── P1-14 (R140-c): resolution workflow — PATCH /api/guests/feedback/[id] ───
  // authFetch (pin-login/usePinAuth) vrže Error s .status + sporočilom { error }
  // za !ok odgovore — zato so napake (409/404/400) obravnavane v onError.
  const updateFeedbackMutation = useMutation({
    mutationFn: async (input: UpdateFeedbackInput) => {
      const res = await authFetch(`/api/guests/feedback/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: input.status,
          // odgovor opcijski: pošlji samo če neprazen (strežnik: trim min1 max1000)
          ...(input.response ? { response: input.response } : {}),
        }),
      })
      return res.json()
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.status === 'resolved' ? 'Mnenje je rešeno' : 'Mnenje je v obdelavi')
      closeResolveDialog()
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback.all })
    },
    onError: (error) => {
      const err = error as Error & { status?: number }
      if (err.status === 409) {
        // CAS kanon (r137 DriverApp): 409 = spremenljivo stanje → TOAST + refetch
        // (invalidacija prinese dejanski status — gumb se pravilno skrije/prikaže)
        toast.info(err.message || 'Stanje je spremenjeno — osveženo')
        closeResolveDialog()
        queryClient.invalidateQueries({ queryKey: queryKeys.feedback.all })
      } else {
        // 404 (tuj tenant / neobstoječ) / 400 Zod / 5xx — sporočilo strežnika
        toast.error(err.message || 'Napaka pri posodabljanju mnenja')
      }
    },
  })

  // ─── P1-14 (R140-c): akcijski handlerji (potrebujejo mutacijo) ───
  const startReview = (id: string) => {
    updateFeedbackMutation.mutate({ id, status: 'in_review' })
  }
  const submitResolve = () => {
    if (!resolveTarget || updateFeedbackMutation.isPending) return
    const response = responseText.trim()
    updateFeedbackMutation.mutate({
      id: resolveTarget.id,
      status: 'resolved',
      ...(response ? { response } : {}),
    })
  }

  // id kartice, ki je v mutaciji (loading state SAMO na njenih gumbih)
  const busyId: string | null =
    updateFeedbackMutation.isPending && updateFeedbackMutation.variables
      ? updateFeedbackMutation.variables.id
      : null

  return {
    feedbacks,
    isLoading,
    showNewDialog,
    setShowNewDialog,
    filterRating,
    setFilterRating,
    // P1-14 (R140-c)
    filterStatus,
    setFilterStatus,
    resolveTarget,
    responseText,
    setResponseText,
    openResolveDialog,
    closeResolveDialog,
    startReview,
    submitResolve,
    updateFeedbackMutation,
    busyId,
    newFeedback,
    setNewFeedback,
    filteredFeedbacks,
    avgRatings,
    ratingDistribution,
    nps,
    createFeedbackMutation,
  }
}

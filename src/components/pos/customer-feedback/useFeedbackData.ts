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
} from './constants'
import type {
  FeedbackEntry,
  NewFeedbackForm,
  AvgRatings,
  RatingDistributionItem,
} from './constants'

export function useFeedbackData() {
  const queryClient = useQueryClient()
  const [_tab, _setTab] = useState<'overview' | 'list' | 'new'>('overview')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [filterRating, setFilterRating] = useState('all')
  const [_selectedFeedback, _setSelectedFeedback] = useState<FeedbackEntry | null>(null)
  const [newFeedback, setNewFeedback] = useState<NewFeedbackForm>(emptyFeedbackForm())

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.feedback.all,
    queryFn: async () => {
      const res = await authFetch('/api/guests/feedback')
      if (!res.ok) {
        return { feedbacks: [], stats: { avgRating: 0, total: 0, nps: 0 } }
      }
      return res.json()
    },
  })

  const feedbacks: FeedbackEntry[] = data?.feedbacks || []
  const _stats = data?.stats || { avgRating: 0, total: 0, nps: 0 }

  const filteredFeedbacks = useMemo(() => {
    if (filterRating === 'all') return feedbacks
    const rating = parseInt(filterRating)
    return feedbacks.filter((f: FeedbackEntry) => f.overallRating === rating)
  }, [feedbacks, filterRating])

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

  return {
    feedbacks,
    isLoading,
    showNewDialog,
    setShowNewDialog,
    filterRating,
    setFilterRating,
    newFeedback,
    setNewFeedback,
    filteredFeedbacks,
    avgRatings,
    ratingDistribution,
    nps,
    createFeedbackMutation,
  }
}

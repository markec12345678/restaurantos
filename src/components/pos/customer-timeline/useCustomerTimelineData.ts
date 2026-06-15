'use client'
// ============================================
// HOOK: Podatki za CRM časovnico gostov
// Nalaganje gostov in pretvorba v profile
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { GuestRow, GuestVisitRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import type { GuestProfile } from './constants'

export function useCustomerTimelineData() {
  const [guests, setGuests] = useState<GuestProfile[]>([])
  const [_loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const loadGuests = useCallback(async () => {
    try {
      const res = await authFetch('/api/guests')
      const data = await res.json()

      const profiles: GuestProfile[] = (data || []).map((g: GuestRow) => {
        const visits = ((g.visits || []) as GuestVisitRow[]).map((v: GuestVisitRow) => ({
          id: v.id,
          date: (v.createdAt || v.visitDate) as string,
          table: (v.table as { number?: string } | null)?.number?.toString() || null,
          server: (v.server as { name?: string } | null)?.name || null,
          total: (v.total || v.spent || 0) as number,
          items: v.items || [],
          rating: (v.rating as number | null) || null,
          feedback: (v.feedback as string | null) || null,
        }))

        const totalSpent = visits.reduce((sum, v) => sum + v.total, 0)
        const totalVisits = visits.length || g.visitCount || 0
        const avgSpend = totalVisits > 0 ? totalSpent / totalVisits : 0

        // Pridobi priljubljene jedi iz obiskov
        const itemCounts: Record<string, number> = {}
        visits.forEach(v => {
          (v.items || []).forEach(item => {
            itemCounts[item] = (itemCounts[item] || 0) + 1
          })
        })
        const favoriteItems = Object.entries(itemCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name]) => name)

        return {
          id: g.id,
          name: g.name || 'Neznan gost',
          phone: g.phone || null,
          email: g.email || null,
          loyaltyPoints: g.loyaltyPoints || 0,
          loyaltyTier: g.loyaltyTier || 'Bronza',
          totalVisits,
          totalSpent,
          avgSpend,
          lastVisit: visits.length > 0 ? visits[0].date : g.lastVisit || null,
          firstVisit: visits.length > 0 ? visits[visits.length - 1].date : g.createdAt || null,
          favoriteItems,
          allergens: g.allergens || [],
          preferences: g.preferences || [],
          notes: g.notes || '',
          visits: visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          tags: g.tags || [],
        }
      })

      // Sortiraj po zadnjem obisku
      profiles.sort((a, b) => {
        const aDate = a.lastVisit ? new Date(a.lastVisit).getTime() : 0
        const bDate = b.lastVisit ? new Date(b.lastVisit).getTime() : 0
        return bDate - aDate
      })

      setGuests(profiles)
    } catch {
      toast.error('Napaka pri nalaganju gostov')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGuests()
  }, [loadGuests])

  return { guests, searchQuery, setSearchQuery }
}

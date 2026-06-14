'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import type { GuestRow, GuestVisitRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import type { GuestProfile, GuestVisit } from './customer-timeline/constants'

// --- Lenično naložene podkomponente ---

const SummaryCards = dynamic(
  () => import('./customer-timeline/SummaryCards').then(m => m.SummaryCards),
  { ssr: false }
)

const GuestList = dynamic(
  () => import('./customer-timeline/GuestList').then(m => m.GuestList),
  { ssr: false }
)

const GuestDetail = dynamic(
  () => import('./customer-timeline/GuestDetail').then(m => m.GuestDetail),
  { ssr: false }
)

// --- Glavna komponenta ---

export const CustomerTimeline = memo(function CustomerTimeline() {
  const [guests, setGuests] = useState<GuestProfile[]>([])
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null)
  const [_loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Naloži seznam gostov iz API-ja
  const loadGuests = useCallback(async () => {
    try {
      const res = await authFetch('/api/guests')
      const data = await res.json()

      const profiles: GuestProfile[] = (data || []).map((g: GuestRow) => {
        const visits: GuestVisit[] = ((g.visits || []) as GuestVisitRow[]).map((v: GuestVisitRow) => ({
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

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleSelectGuest = useCallback((guest: GuestProfile) => {
    setSelectedGuest(guest)
  }, [])

  // Filtriraj goste po iskalnem nizu
  const filteredGuests = guests.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.phone && g.phone.includes(searchQuery)) ||
    (g.email && g.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Statistike
  const totalGuests = guests.length
  const returningGuests = guests.filter(g => g.totalVisits > 1).length
  const avgSpendAll = totalGuests > 0 ? guests.reduce((s, g) => s + g.avgSpend, 0) / totalGuests : 0
  const vipGuests = guests.filter(g => g.loyaltyTier === 'Zlato' || g.loyaltyTier === 'Platina').length

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <UserCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">CRM časovnica gostov</h2>
            <p className="text-sm text-muted-foreground">Obiski, preference, alergeni in zvestoba</p>
          </div>
        </div>
      </div>

      {/* Povzetek */}
      <SummaryCards
        totalGuests={totalGuests}
        returningGuests={returningGuests}
        avgSpendAll={avgSpendAll}
        vipGuests={vipGuests}
      />

      <div className="flex gap-4 h-[calc(100%-200px)]">
        {/* Seznam gostov */}
        <GuestList
          guests={filteredGuests}
          searchQuery={searchQuery}
          selectedGuestId={selectedGuest?.id ?? null}
          onSearchChange={handleSearchChange}
          onSelectGuest={handleSelectGuest}
        />

        {/* Podrobnosti gosta */}
        <div className="flex-1">
          <GuestDetail guest={selectedGuest} />
        </div>
      </div>
    </div>
  )
})

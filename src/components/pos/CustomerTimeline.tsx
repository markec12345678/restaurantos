'use client'

import { useState, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { UserCircle } from 'lucide-react'
import type { GuestProfile } from './customer-timeline/constants'
import { useCustomerTimelineData } from './customer-timeline/useCustomerTimelineData'

// Lenično naložene podkomponente
const SummaryCards = dynamic(
  () => import('./customer-timeline/SummaryCards').then(m => ({ default: m.SummaryCards })),
  { ssr: false }
)

const GuestList = dynamic(
  () => import('./customer-timeline/GuestList').then(m => ({ default: m.GuestList })),
  { ssr: false }
)

const GuestDetail = dynamic(
  () => import('./customer-timeline/GuestDetail').then(m => ({ default: m.GuestDetail })),
  { ssr: false }
)

// ============================================
// GLAVNA KOMPONENTA: CRM časovnica gostov
// ============================================

export const CustomerTimeline = memo(function CustomerTimeline() {
  const { guests, searchQuery, setSearchQuery } = useCustomerTimelineData()
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null)

  // --- Handlerji ---

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [setSearchQuery])

  const handleSelectGuest = useCallback((guest: GuestProfile) => {
    setSelectedGuest(guest)
  }, [])

  // --- Izračuni ---

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

  // ============================================
  // RENDER
  // ============================================

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

'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import type { GuestFormRow, GuestRow } from '@/lib/types'
import { type GuestData, emptyGuestForm } from './guest/constants'

// Lazy-loaded podkomponente
const GuestHeader = dynamic(() => import('./guest/GuestHeader').then(m => ({ default: m.GuestHeader })), { ssr: false })
const GuestSearch = dynamic(() => import('./guest/GuestSearch').then(m => ({ default: m.GuestSearch })), { ssr: false })
const GuestList = dynamic(() => import('./guest/GuestList').then(m => ({ default: m.GuestList })), { ssr: false })
const GuestDetail = dynamic(() => import('./guest/GuestDetail').then(m => ({ default: m.GuestDetail })), { ssr: false })
const GuestFormModal = dynamic(() => import('./guest/GuestFormModal').then(m => ({ default: m.GuestFormModal })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const GuestManager = memo(function GuestManager() {
  const [guests, setGuests] = useState<GuestData[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [vipOnly, setVipOnly] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<GuestData | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<GuestFormRow>({} as GuestFormRow)
  const [tab, setTab] = useState<'list' | 'detail'>('list')

  // ============================================
  // QUERIES
  // ============================================

  const fetchGuests = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (vipOnly) params.set('vip', 'true')
      const res = await authFetch(`/api/guests?${params}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const data = await res.json()
      setGuests(Array.isArray(data?.guests) ? data.guests : [])
      setTotal(data?.total || 0)
    } catch {
      toast.error('Napaka pri nalaganju gostov')
    }
  }, [search, vipOnly])

  useEffect(() => { fetchGuests() }, [fetchGuests])

  // ============================================
  // MUTATIONS
  // ============================================

  async function createGuest() {
    try {
      const res = await authFetch('/api/guests', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Napaka')
      setShowForm(false)
      setForm({} as GuestFormRow)
      fetchGuests()
    } catch {
      toast.error('Napaka pri dodajanju gosta')
    }
  }

  async function updateGuest(id: string, data: Partial<GuestRow>) {
    try {
      const res = await authFetch(`/api/guests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      const updated = await res.json()
      if (selectedGuest?.id === id) setSelectedGuest(updated)
      fetchGuests()
    } catch {
      toast.error('Napaka pri posodabljanju gosta')
    }
  }

  async function selectGuest(id: string) {
    try {
      const res = await authFetch(`/api/guests/${id}`)
      const data = await res.json()
      setSelectedGuest(data)
      setTab('detail')
    } catch {
      toast.error('Napaka pri nalaganju gosta')
    }
  }

  // ============================================
  // HANDLERJI
  // ============================================

  const handleNewGuest = useCallback(() => {
    setShowForm(true)
    setForm(emptyGuestForm())
  }, [])

  const handleBackToList = useCallback(() => {
    setTab('list')
  }, [])

  const handleToggleVip = useCallback((id: string, _currentVip: boolean) => {
    updateGuest(id, { isVip: !_currentVip } as Partial<GuestRow>)
  }, [selectedGuest])

  // ============================================
  // GLAVNI RENDER
  // ============================================

  return (
    <div className="h-full flex flex-col">
      {/* Glava */}
      <GuestHeader
        total={total}
        vipOnly={vipOnly}
        onVipToggle={() => setVipOnly(!vipOnly)}
        onNewGuest={handleNewGuest}
      />

      {/* Iskanje */}
      <GuestSearch
        value={search}
        onChange={setSearch}
      />

      {/* Vsebina */}
      <div className="flex-1 overflow-hidden flex">
        {/* Seznam gostov */}
        <GuestList
          guests={guests}
          selectedGuestId={selectedGuest?.id ?? null}
          tab={tab}
          onSelectGuest={selectGuest}
        />

        {/* Podrobnosti gosta */}
        {tab === 'detail' && selectedGuest && (
          <GuestDetail
            guest={selectedGuest}
            onBack={handleBackToList}
            onToggleVip={handleToggleVip}
          />
        )}
      </div>

      {/* Modal za dodajanje novega gosta */}
      <GuestFormModal
        open={showForm}
        form={form}
        onFormChange={setForm}
        onClose={() => setShowForm(false)}
        onSubmit={createGuest}
      />
    </div>
  )
})

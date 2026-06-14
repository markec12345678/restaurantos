'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import dynamic from 'next/dynamic'
import { type HappyHourSchedule, type HappyHourFormState, EMPTY_HH_FORM } from '../happyhour/types'

// Lazy-loaded podkomponente
const HappyHourScheduleCard = dynamic(() => import('../happyhour/HappyHourScheduleCard').then(m => ({ default: m.HappyHourScheduleCard })), { ssr: false })
const HappyHourForm = dynamic(() => import('../happyhour/HappyHourForm').then(m => ({ default: m.HappyHourForm })), { ssr: false })

// ============================================
// CUSTOM TAB: HAPPY HOUR
// Upravljanje urnikov Happy Hour s ceniki
// ============================================

export function HappyHourTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['happy-hour-config'],
    queryFn: async () => {
      const res = await authFetch('/api/happy-hour')
      if (!res.ok) return { schedules: [], activeSchedules: [], currentlyActive: false }
      return res.json()
    },
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<HappyHourFormState>({ ...EMPTY_HH_FORM })
  const [saving, setSaving] = useState(false)
  const schedules: HappyHourSchedule[] = data?.schedules || []
  const currentlyActive = data?.currentlyActive || false
  const { data: priceGroups } = useQuery({
    queryKey: ['price-groups-hh'],
    queryFn: async () => {
      const res = await authFetch('/api/configuration/price-groups')
      if (!res.ok) return []
      return res.json()
    },
  })

  const save = async () => {
    setSaving(true)
    try {
      const res = await authFetch('/api/happy-hour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Napaka')
      }
      toast.success('Happy Hour urnik ustvarjen')
      queryClient.invalidateQueries({ queryKey: ['happy-hour-config'] })
      setShowForm(false)
      setForm({ ...EMPTY_HH_FORM })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Napaka'
      toast.error(msg || 'Napaka pri shranjevanju')
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day) ? prev.daysOfWeek.filter(d => d !== day) : [...prev.daysOfWeek, day].sort(),
    }))
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/happy-hour/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
    },
    onSuccess: () => {
      toast.success('Izbrisano')
      queryClient.invalidateQueries({ queryKey: ['happy-hour-config'] })
    },
    onError: () => toast.error('Napaka pri brisanju'),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await authFetch(`/api/happy-hour/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error('Napaka')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['happy-hour-config'] }),
  })

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>

  return (
    <div className="space-y-4">
      {/* Trenutno aktivni banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${currentlyActive ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
        <Sparkles className={`h-5 w-5 ${currentlyActive ? 'text-amber-500' : 'text-gray-500'}`} />
        <span className={`font-semibold ${currentlyActive ? 'text-amber-700' : 'text-gray-500'}`}>
          {currentlyActive ? 'Happy Hour je trenutno AKTIVEN!' : 'Happy Hour trenutno ni aktiven'}
        </span>
      </div>

      {/* Seznam urnikov */}
      {schedules.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-lg font-medium text-muted-foreground">Ni še definiranih Happy Hour urnikov</p>
          <p className="text-sm text-muted-foreground">Ustvarite prvi urnik za samodejne popuste</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => (
            <HappyHourScheduleCard
              key={s.id}
              schedule={s}
              currentlyActive={currentlyActive}
              onToggleActive={(id, isActive) => toggleMutation.mutate({ id, isActive })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Obrazec za nov urnik */}
      {showForm ? (
        <HappyHourForm
          form={form}
          onFormChange={setForm}
          onToggleDay={toggleDay}
          onSave={save}
          onCancel={() => setShowForm(false)}
          saving={saving}
          priceGroups={priceGroups}
        />
      ) : (
        <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Dodaj Happy Hour urnik
        </Button>
      )}
    </div>
  )
}

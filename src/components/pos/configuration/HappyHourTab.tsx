'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { asArray } from '@/lib/as-array' // R71: "(x || []).map" ne ščiti pred truthy non-array
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import dynamic from 'next/dynamic'
import { type HappyHourSchedule, type HappyHourFormState, EMPTY_HH_FORM } from '../happyhour/types'
import type { PriceGroupRow } from '@/lib/types'

// Lazy-loaded podkomponente
const HappyHourScheduleCard = dynamic(() => import('../happyhour/HappyHourScheduleCard').then(m => ({ default: m.HappyHourScheduleCard })), { ssr: false })
const HappyHourForm = dynamic(() => import('../happyhour/HappyHourForm').then(m => ({ default: m.HappyHourForm })), { ssr: false })
const HappyHourDeleteDialog = dynamic(() => import('../happyhour/HappyHourDeleteDialog').then(m => ({ default: m.HappyHourDeleteDialog })), { ssr: false })

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
  // RUNDA 69: potrditveni dialog za izbris (prej nevaren instant delete)
  const [deleteTarget, setDeleteTarget] = useState<HappyHourSchedule | null>(null)
  const schedules: HappyHourSchedule[] = asArray(data?.schedules) // R71: fail-safe (truthy non-array → [])
  const currentlyActive = data?.currentlyActive || false
  const { data: priceGroups } = useQuery({
    queryKey: ['price-groups-hh'],
    queryFn: async () => {
      const res = await authFetch('/api/configuration/price-groups')
      if (!res.ok) return []
      // FIX R69: API vrne { priceGroups: [...] } — prej smo podali CEL objekt
      // v HappyHourForm, ki kliče .map() → "(m || []).map is not a function"
      // → CRASH celotnega konfiguracijskega modula ob odprtju obrazca. Obrazec
      // Happy Hour je bil s tem mrtv od vedno (nikoli testiran — toggle/izbris
      // taba sta bila tudi pokvarjena, glej R69).
      const d = (await res.json().catch(() => null)) as { priceGroups?: PriceGroupRow[] } | PriceGroupRow[] | null
      if (Array.isArray(d)) return d
      return d?.priceGroups ?? []
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

  // RUNDA 69: parse error body — API zdaj obstaja in vrača slovenska sporočila
  // (404 "urnik ni najden"). Prej: 200 + HTML lažni uspeh (toast brez efekta).
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/happy-hour/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Napaka pri brisanju urnika')
      }
    },
    onSuccess: (_data, id) => {
      toast.success('Urnik izbrisan')
      queryClient.invalidateQueries({ queryKey: ['happy-hour-config'] })
      setDeleteTarget(prev => (prev?.id === id ? null : prev))
    },
    onError: (e: Error) => toast.error(e.message || 'Napaka pri brisanju urnika'),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await authFetch(`/api/happy-hour/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Napaka pri preklopu urnika')
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['happy-hour-config'] }),
    onError: (e: Error) => toast.error(e.message || 'Napaka pri preklopu urnika'),
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
              onDelete={() => setDeleteTarget(s)}
            />
          ))}
        </div>
      )}

      {/* RUNDA 69: potrditev pred izbrisom (prej instant, brez dialoga) */}
      <HappyHourDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        target={deleteTarget}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
        isPending={deleteMutation.isPending}
      />

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

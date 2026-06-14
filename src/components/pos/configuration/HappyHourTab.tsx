'use client'
import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { PriceGroupRow } from '@/lib/types'
import { Plus, Trash2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// CUSTOM TAB: HAPPY HOUR
// Upravljanje urnikov Happy Hour s ceniki
// ============================================
interface HappyHourSchedule {
  id: string
  name: string
  description: string
  priceGroupId: string
  priceGroup?: { id: string; name: string }
  discountType: string
  discountAmount: number
  daysOfWeek: string
  startTime: string
  endTime: string
  validFrom: string | null
  validTo: string | null
  isActive: boolean
  autoActivate: boolean
}

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
  const [form, setForm] = useState({
    name: '', description: '', priceGroupId: '', discountType: 'percentage', discountAmount: 0,
    daysOfWeek: [1, 2, 3, 4, 5] as number[], startTime: '14:00', endTime: '17:00',
    validFrom: '', validTo: '', isActive: true, autoActivate: true,
  })
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
      setForm({ name: '', description: '', priceGroupId: '', discountType: 'percentage', discountAmount: 0, daysOfWeek: [1, 2, 3, 4, 5], startTime: '14:00', endTime: '17:00', validFrom: '', validTo: '', isActive: true, autoActivate: true })
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
  const dayLabels = ['', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
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
            <Card key={s.id} className={`${!s.isActive ? 'opacity-60' : ''} ${currentlyActive && s.isActive ? 'border-amber-300 shadow-amber-100' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{s.name}</h3>
                      <Badge variant={s.isActive ? 'default' : 'secondary'} className={s.isActive ? 'bg-green-600' : ''}>
                        {s.isActive ? 'Aktiven' : 'Neaktiven'}
                      </Badge>
                    </div>
                    {s.description && <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <Badge variant="outline">{s.startTime} - {s.endTime}</Badge>
                      {s.discountType !== 'none' && (
                        <Badge variant="default">
                          {s.discountType === 'percentage' ? `-${s.discountAmount}%` : `-€${s.discountAmount.toFixed(2)}`}
                        </Badge>
                      )}
                      {s.priceGroup && <Badge variant="secondary">{s.priceGroup.name}</Badge>}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {(() => {
                        try {
                          const days: number[] = JSON.parse(s.daysOfWeek || '[]')
                          return days.map(d => (
                            <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">{dayLabels[d] || d}</span>
                          ))
                        } catch { return null }
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.isActive} onCheckedChange={v => toggleMutation.mutate({ id: s.id, isActive: v })} />
                    <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Obrazec za nov urnik */}
      {showForm ? (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Nov Happy Hour urnik
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Ime (npr. Popoldanski popust) *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}  aria-label="Ime (npr. Popoldanski popust) *"/>
            <Textarea placeholder="Opis (opcijsko)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}  aria-label="Opis (opcijsko)"/>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vrsta popusta</Label>
                <Select value={form.discountType} onValueChange={v => setForm(p => ({ ...p, discountType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Odstotek</SelectItem>
                    <SelectItem value="fixed">Fiksni znesek</SelectItem>
                    <SelectItem value="none">Brez popusta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Znesek {form.discountType === 'percentage' ? '(%)' : '(€)'}</Label>
                <Input type="number" step="0.5" value={form.discountAmount} onChange={e => setForm(p => ({ ...p, discountAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Cenik (Price Group)</Label>
              <Select value={form.priceGroupId} onValueChange={v => setForm(p => ({ ...p, priceGroupId: v }))}>
                <SelectTrigger><SelectValue placeholder="Izberi cenik..." /></SelectTrigger>
                <SelectContent>
                  {(priceGroups || []).map((pg: PriceGroupRow) => (
                    <SelectItem key={pg.id} value={pg.id}>{pg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Od (ura)</Label>
                <Input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>Do (ura)</Label>
                <Input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Dnevi v tednu</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold transition ${form.daysOfWeek.includes(d) ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}
                  >
                    {dayLabels[d]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Veljavno od</Label>
                <Input type="date" value={form.validFrom} onChange={e => setForm(p => ({ ...p, validFrom: e.target.value }))} />
              </div>
              <div>
                <Label>Veljavno do</Label>
                <Input type="date" value={form.validTo} onChange={e => setForm(p => ({ ...p, validTo: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={!form.name || saving} className="flex-1">
                {saving ? 'Ustvarjam...' : 'Ustvari Happy Hour'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Prekliči</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Dodaj Happy Hour urnik
        </Button>
      )}
    </div>
  )
}

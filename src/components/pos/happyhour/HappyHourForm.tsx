'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Sparkles } from 'lucide-react'
import { type HappyHourFormState, DAY_LABELS } from './types'
import type { PriceGroupRow } from '@/lib/types'

// ============================================
// OBRAZEC ZA NOV HAPPY HOUR URNIK
// ============================================

interface HappyHourFormProps {
  form: HappyHourFormState
  onFormChange: (_form: HappyHourFormState) => void
  onToggleDay: (_day: number) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  priceGroups: PriceGroupRow[] | undefined
}

export const HappyHourForm = memo(function HappyHourForm({
  form,
  onFormChange,
  onToggleDay,
  onSave,
  onCancel,
  saving,
  priceGroups,
}: HappyHourFormProps) {
  const set = (partial: Partial<HappyHourFormState>) => onFormChange({ ...form, ...partial })

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Nov Happy Hour urnik
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Ime (npr. Popoldanski popust) *" value={form.name} onChange={e => set({ name: e.target.value })} aria-label="Ime urnika" />
        <Textarea placeholder="Opis (opcijsko)" value={form.description} onChange={e => set({ description: e.target.value })} rows={2} aria-label="Opis" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vrsta popusta</Label>
            <Select value={form.discountType} onValueChange={v => set({ discountType: v })}>
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
            <Input type="number" step="0.5" value={form.discountAmount} onChange={e => set({ discountAmount: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div>
          <Label>Cenik (Price Group)</Label>
          <Select value={form.priceGroupId} onValueChange={v => set({ priceGroupId: v })}>
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
            <Label htmlFor="hh-start">Od (ura)</Label>
            <Input id="hh-start" type="time" value={form.startTime} onChange={e => set({ startTime: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="hh-end">Do (ura)</Label>
            <Input id="hh-end" type="time" value={form.endTime} onChange={e => set({ endTime: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Dnevi v tednu</Label>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5, 6, 7].map(d => (
              <button
                key={d}
                onClick={() => onToggleDay(d)}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition ${form.daysOfWeek.includes(d) ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {DAY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="hh-valid-from">Veljavno od</Label>
            <Input id="hh-valid-from" type="date" value={form.validFrom} onChange={e => set({ validFrom: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="hh-valid-to">Veljavno do</Label>
            <Input id="hh-valid-to" type="date" value={form.validTo} onChange={e => set({ validTo: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onSave} disabled={!form.name || saving} className="flex-1">
            {saving ? 'Ustvarjam...' : 'Ustvari Happy Hour'}
          </Button>
          <Button variant="outline" onClick={onCancel}>Prekliči</Button>
        </div>
      </CardContent>
    </Card>
  )
})

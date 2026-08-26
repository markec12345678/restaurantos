'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Coins, ArrowUpCircle, ArrowDownCircle, RotateCcw } from 'lucide-react'
import { type LoyaltyAccount, formatPoints } from './constants'

interface AdjustData {
  type: 'earn' | 'redeem' | 'adjust'
  points: string
  reason: string
  monetaryValue: string
}

interface LoyaltyAdjustFormProps {
  adjustAccount: LoyaltyAccount | null
  adjustData: AdjustData
  isPending: boolean
  onAdjustDataChange: (_data: AdjustData) => void
  onSubmit: () => void
  onCancel: () => void
}

export const LoyaltyAdjustForm = memo(function LoyaltyAdjustForm({
  adjustAccount,
  adjustData,
  isPending,
  onAdjustDataChange,
  onSubmit,
  onCancel,
}: LoyaltyAdjustFormProps) {
  return (
    <div className="space-y-4">
      {adjustAccount && (
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/50">
          <span className="text-sm text-muted-foreground">Trenutno stanje točk</span>
          <span className="font-bold text-lg">{formatPoints(adjustAccount.pointsBalance)}</span>
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Vrsta transakcije</Label>
        <Select value={adjustData.type} onValueChange={(v) => onAdjustDataChange({ ...adjustData, type: v as 'earn' | 'redeem' | 'adjust' })}>
          <SelectTrigger autoFocus><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="earn"><span className="flex items-center gap-2"><ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />Prislužene točke</span></SelectItem>
            <SelectItem value="redeem"><span className="flex items-center gap-2"><ArrowDownCircle className="h-3.5 w-3.5 text-blue-600" />Unovči točke</span></SelectItem>
            <SelectItem value="adjust"><span className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5 text-amber-600" />Prilagoditev</span></SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Število točk *</Label>
        <Input type="number" min="1" placeholder="npr. 100" value={adjustData.points} onChange={(e) => onAdjustDataChange({ ...adjustData, points: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Denarna vrednost (€)</Label>
        <Input type="number" step="0.01" min="0" placeholder="npr. 5.00" value={adjustData.monetaryValue} onChange={(e) => onAdjustDataChange({ ...adjustData, monetaryValue: e.target.value })} />
        <p className="text-xs text-muted-foreground">Neobvezno — vnesite, če točke ustrezajo določenemu znesku</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Razlog *</Label>
        <Textarea placeholder="npr. Rojstnodnevni bonus, kompenzacija, napaka..." value={adjustData.reason} onChange={(e) => onAdjustDataChange({ ...adjustData, reason: e.target.value })} rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Prekliči</Button>
        <Button onClick={onSubmit} disabled={isPending}>
          {isPending ? (<><span className="animate-spin mr-2">⏳</span>Prilagajam...</>) : (<><Coins className="h-4 w-4 mr-1.5" />Potrdi</>)}
        </Button>
      </div>
    </div>
  )
})

export type { AdjustData }

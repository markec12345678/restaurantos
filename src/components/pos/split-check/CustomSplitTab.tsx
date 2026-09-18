'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import type { CustomSplitTabProps } from './constants'
import { formatEUR } from '@/lib/safe-format'

export const CustomSplitTab = memo(function CustomSplitTab({
  parties,
  customAmounts,
  onCustomAmountChange,
  onCustomAmountDelete,
  orderTotal,
  autoGratuityAmount,
  customTotal,
  customDifference,
  isCustomValid,
  onAddParty,
  onRemoveParty,
  onClose,
  onConfirmCustom,
}: CustomSplitTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vnesi znesek za vsako osebo. Skupaj mora ustrezati {formatEUR(orderTotal + autoGratuityAmount)}.
      </p>
      {parties.map((party) => (
        <div key={party.id} className="flex items-center gap-3">
          <span className="text-sm font-medium w-24">{party.name}</span>
          <div className="flex-1">
            <DecimalInput
              id={`custom-amount-${party.id}`}
              placeholder="0.00"
              className="h-9"
              value={customAmounts[party.id] !== undefined ? customAmounts[party.id].toFixed(2) : ''}
              onValueChange={(n) => onCustomAmountChange(party.id, n)}
              aria-label="Znesek delitve"
            />
          </div>
          <span className="text-sm text-muted-foreground">€</span>
          {parties.length > 1 && (
            <Button variant="ghost" size="icon" aria-label="Izbriši" className="h-7 w-7" onClick={() => {
              onRemoveParty(party.id)
              onCustomAmountDelete(party.id)
            }}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" onClick={() => {
        onAddParty()
      }} size="sm" className="gap-1">
        <Plus className="h-3 w-3" /> Dodaj osebo
      </Button>
      {/* Povzetek */}
      <div className={`flex items-center justify-between p-3 rounded-lg border ${
        customDifference === 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
      }`}>
        <span className="text-sm font-medium">Skupaj:</span>
        <div className="text-right">
          <span className={`text-sm font-bold ${customDifference === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {formatEUR(customTotal)} / {formatEUR(orderTotal + autoGratuityAmount)}
          </span>
          {customDifference !== 0 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {customDifference > 0 ? `Manjka ${formatEUR(customDifference)}` : `Preseženo za ${formatEUR(Math.abs(customDifference))}`}
            </p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Prekliči</Button>
        <Button onClick={onConfirmCustom} disabled={!isCustomValid} className="gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          Potrdi
        </Button>
      </DialogFooter>
    </div>
  )
})

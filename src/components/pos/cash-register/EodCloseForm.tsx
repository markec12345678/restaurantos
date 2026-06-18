'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { CalendarCheck, FileText } from 'lucide-react'
import type { EodFormType } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodCloseFormProps {
  eodData: EodData
  form: EodFormType
  onFormChange: (_form: EodFormType) => void
  onSubmit: () => void
  isPending: boolean
}

export const EodCloseForm = memo(function EodCloseForm({
  eodData,
  form,
  onFormChange,
  onSubmit,
  isPending,
}: EodCloseFormProps) {
  return (
    <>
      <Separator />
      <div className="space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Zaključi obratovalni dan
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="eod-cash" className="text-sm font-medium">Dejanska gotovina (&euro;)</label>
            <Input
              id="eod-cash"
              type="number"
              step="0.01"
              placeholder={eodData.activeShift ? String(safeToFixed(eodData.activeShift.startingCash + eodData.summary.totalRevenue, 2)) : '0.00'}
              value={form.closingCash}
              onChange={e => onFormChange({ ...form, closingCash: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="eod-notes" className="text-sm font-medium">Opombe</label>
            <Input id="eod-notes" placeholder="Opombe ob zaključku..." value={form.notes} onChange={e => onFormChange({ ...form, notes: e.target.value })} aria-label="Opombe ob zaključku"/>
          </div>
        </div>

        {eodData.summary.pendingOrders > 0 ? (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Ne morete zaključiti dneva — imate {eodData.summary.pendingOrders} odprtih naročil.
            </p>
          </div>
        ) : !eodData.activeShift ? (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground">
              Ni odprte blagajniške izmene. Dan je že zaključen.
            </p>
          </div>
        ) : (
          <Button
            className="w-full"
            size="lg"
            onClick={onSubmit}
            disabled={isPending}
            aria-label="Zaključi obratovalni dan"
          >
            <CalendarCheck className="h-4 w-4 mr-2" />
            {isPending ? 'Zaključujem...' : 'ZAKLJUČI OBRATOVALNI DAN'}
          </Button>
        )}
      </div>
    </>
  )
})

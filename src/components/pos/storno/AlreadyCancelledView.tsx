'use client'

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileWarning } from 'lucide-react'
import type { AlreadyCancelledViewProps } from './constants'

// ============================================
// PRIKAZ ŽE STORNIRANEGA/PREKLICANEGA NAROČILA
// ============================================
export const AlreadyCancelledView = memo(function AlreadyCancelledView({
  order,
  open,
  onClose,
  isStorno,
  totalWithTip,
}: AlreadyCancelledViewProps) {
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <FileWarning className="h-5 w-5" />
            {isStorno ? 'Stornirano naročilo' : 'Preklicano naročilo'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
            <p className="font-medium">Naročilo #{order.orderNumber} je {isStorno ? 'stornirano' : 'preklicano'}.</p>
            <p className="text-xs text-muted-foreground mt-1">Te operacije ni mogoče razveljaviti.</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Znesek</span>
              <span className="font-semibold">&euro;{totalWithTip.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} autoFocus>Zapri</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

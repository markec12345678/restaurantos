'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Dialog za kopiranje tedna (Copy Week Dialog)
// Kopiranje razporeda iz prejšnjega tedna
// ═══════════════════════════════════════════════════════════════
import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'

// ─── Props ─────────────────────────────────────────────────────
export interface CopyWeekDialogProps {
  open: boolean
  onClose: () => void
  onOpenChange: (_open: boolean) => void
  copySourceDate: string
  onCopySourceDateChange: (_date: string) => void
  defaultSourceDate: string
  onCopy: () => void
}

// ─── Komponenta ────────────────────────────────────────────────
export const CopyWeekDialog = memo(function CopyWeekDialog({
  open,
  onClose,
  onOpenChange,
  copySourceDate,
  onCopySourceDateChange,
  defaultSourceDate,
  onCopy,
}: CopyWeekDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Kopiraj razpored
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Kopiraj razpored iz prejšnjega tedna v prihodnji teden. Obstajajoče izmene ne bodo prepisane.
          </p>
          <div>
            <label htmlFor="shift-copy-source" className="text-xs font-medium">Izvorni teden</label>
            <Input
              id="shift-copy-source"
              type="date"
              value={copySourceDate || defaultSourceDate}
              onChange={e => onCopySourceDateChange(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={onCopy}>
            Kopiraj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

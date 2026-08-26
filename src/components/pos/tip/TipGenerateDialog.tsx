'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { METHOD_LABELS } from './constants'

interface TipGenerateDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  method: string
  onMethodChange: (_method: string) => void
  onGenerate: () => void
  isPending: boolean
}

export const TipGenerateDialog = memo(function TipGenerateDialog({
  open,
  onOpenChange,
  method,
  onMethodChange,
  onGenerate,
  isPending,
}: TipGenerateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generiraj tip pool</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="tip-method" className="text-sm font-medium">Metoda distribucije</label>
            <Select value={method} onValueChange={onMethodChange}>
              <SelectTrigger className="mt-1" id="tip-method" autoFocus>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABELS).map(([key, { label, desc }]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onGenerate} disabled={isPending}>
            Generiraj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

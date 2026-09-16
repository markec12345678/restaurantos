'use client'

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
}

export const ShortcutsDialog = memo(function ShortcutsDialog({
  open,
  onOpenChange,
}: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" tabIndex={-1}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Tipkovne bližnjice
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {[
            { key: 'F2', desc: 'Novo naročilo' },
            { key: 'F4', desc: 'Plačaj / Oddaj' },
            { key: 'F5', desc: 'Seznam naročil' },
            { key: 'F8', desc: 'Počisti košarico' },
            { key: 'Ctrl+K', desc: 'Išči artikel' },
            { key: 'Esc', desc: 'Zapri / Prekliči' },
          ].map(s => (
            <div key={s.key} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <span className="text-muted-foreground">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-muted border border-border text-xs font-mono font-semibold">{s.key}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
})

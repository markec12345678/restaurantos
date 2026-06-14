'use client'

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface ClearCartDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
}

export const ClearCartDialog = memo(function ClearCartDialog({
  open,
  onOpenChange,
  onConfirm,
}: ClearCartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Po\u010Disti ko\u0161arico?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Ali ste prepri\u010Dani, da \u017Eelite izbrisati vse artikle iz ko\u0161arice? Tega dejanja ni mogo\u010De razveljaviti.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} autoFocus>Prekli\u010Di</Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Trash2 className="h-4 w-4 mr-1" />
            Po\u010Di\u0161ti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

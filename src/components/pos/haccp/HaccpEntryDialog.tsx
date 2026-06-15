'use client'

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, ShieldCheck } from 'lucide-react'
import type { HaccpEntry, HaccpFormData } from './types'
import { HaccpFormFields } from './HaccpFormFields'

interface HaccpEntryDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  editingEntry: HaccpEntry | null
  formData: HaccpFormData
  setFormData: React.Dispatch<React.SetStateAction<HaccpFormData>>
  onSave: () => void
  isCreatePending: boolean
  isUpdatePending: boolean
}

export const HaccpEntryDialog = memo(function HaccpEntryDialog({
  open,
  onOpenChange,
  editingEntry,
  formData,
  setFormData,
  onSave,
  isCreatePending,
  isUpdatePending,
}: HaccpEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) { onOpenChange(false) } else { onOpenChange(true) } }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {editingEntry ? 'Uredi HACCP vnos' : 'Nov HACCP vnos'}
          </DialogTitle>
          <DialogDescription>
            {editingEntry
              ? 'Posodobite podatke obstoječega HACCP vnosa.'
              : 'Vnesite novo kontrolo ali meritev v HACCP dnevnik.'}
          </DialogDescription>
        </DialogHeader>

        <HaccpFormFields formData={formData} setFormData={setFormData} />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Prekliči
          </Button>
          <Button
            onClick={onSave}
            disabled={
              !formData.title.trim() ||
              !formData.employeeName.trim() ||
              isCreatePending ||
              isUpdatePending
            }
          >
            {isCreatePending || isUpdatePending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {editingEntry ? 'Posodabljam...' : 'Vnašam...'}
              </>
            ) : editingEntry ? (
              'Posodobi vnos'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Dodaj vnos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

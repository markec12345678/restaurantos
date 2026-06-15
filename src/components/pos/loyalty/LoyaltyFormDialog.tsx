'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Plus, Award } from 'lucide-react'
import { type LoyaltyAccount } from './constants'
import type { FormData } from './LoyaltyFormFields'

const LoyaltyFormFields = dynamic(() => import('./LoyaltyFormFields').then(m => ({ default: m.LoyaltyFormFields })), { ssr: false })

// --- Props ---

interface LoyaltyFormDialogProps {
  open: boolean
  editingAccount: LoyaltyAccount | null
  formData: FormData
  isCreatePending: boolean
  isUpdatePending: boolean
  onOpenChange: (_open: boolean) => void
  onFormDataChange: (_data: FormData) => void
  onSubmit: () => void
  onCancel: () => void
}

// --- Komponenta ---

export const LoyaltyFormDialog = memo(function LoyaltyFormDialog({
  open,
  editingAccount,
  formData,
  isCreatePending,
  isUpdatePending,
  onOpenChange,
  onFormDataChange,
  onSubmit,
  onCancel,
}: LoyaltyFormDialogProps) {
  const isPending = isCreatePending || isUpdatePending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {editingAccount ? 'Uredi zvestobni račun' : 'Dodaj račun'}
          </DialogTitle>
          <DialogDescription>
            {editingAccount
              ? 'Posodobite podatke obstoječega zvestobnega računa.'
              : 'Ustvarite nov zvestobni račun za stranko.'}
          </DialogDescription>
        </DialogHeader>

        <LoyaltyFormFields formData={formData} onFormDataChange={onFormDataChange} />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Prekliči
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              !formData.customerName.trim() ||
              isPending
            }
          >
            {isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {editingAccount ? 'Posodabljam...' : 'Vnašam...'}
              </>
            ) : editingAccount ? (
              'Posodobi račun'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Dodaj račun
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

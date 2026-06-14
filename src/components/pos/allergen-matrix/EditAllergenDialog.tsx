'use client'

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Save, ShieldAlert, X } from 'lucide-react'
import { EU_ALLERGENS } from './constants'
import type { EditAllergenDialogProps } from './constants'

// ============================================
// DIALOG ZA UREJANJE ALERGENOV ARTIKLA
// ============================================

export const EditAllergenDialog = memo(function EditAllergenDialog({
  open,
  editItem,
  editAllergens,
  onOpenChange,
  onEditAllergensChange,
  onSave,
  isPending,
}: EditAllergenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            Alergeni: {editItem?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Označite vse alergene, ki jih artikel vsebuje ali lahko vsebuje (sledi).
          </p>
          <div className="grid grid-cols-2 gap-2">
            {EU_ALLERGENS.map(a => {
              const isActive = editAllergens.includes(a.id)
              return (
                <button
                  key={a.id}
                  className={`p-2 rounded-lg border-2 text-left transition-all ${
                    isActive
                      ? 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => {
                    onEditAllergensChange(
                      editAllergens.includes(a.id)
                        ? editAllergens.filter(x => x !== a.id)
                        : [...editAllergens, a.id]
                    )
                  }}
                  autoFocus={a.id === EU_ALLERGENS[0].id}
                  aria-label={`${a.label}${isActive ? ' (izbrano)' : ''}`}
                  aria-pressed={isActive}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{a.label}</p>
                      <p className="text-[9px] text-muted-foreground">{a.labelEn}</p>
                    </div>
                    {isActive && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-3 w-3 mr-1" /> Prekliči
          </Button>
          <Button onClick={onSave} disabled={isPending}>
            <Save className="h-3 w-3 mr-1" /> Shrani
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

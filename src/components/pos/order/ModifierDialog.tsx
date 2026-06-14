'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Check } from 'lucide-react'
import type { ModifierGroupType, MenuItemType } from './MenuBrowser'
import type { SelectedModifier } from '@/lib/store'

// ============================================
// TIPI
// ============================================
export interface ModifierDialogProps {
  modifierDialogItem: MenuItemType | null
  selectedModifiers: Map<string, SelectedModifier>
  modifierExtraPrice: number
  onToggle: (_group: ModifierGroupType['modifierGroup'], _modifier: { id: string; name: string; price: number }) => void
  onConfirm: () => void
  onClose: () => void
}

// ============================================
// MODIFIER DIALOG - Dialog za izbiro modifierjev
// ============================================
export const ModifierDialog = memo(function ModifierDialog({
  modifierDialogItem,
  selectedModifiers,
  modifierExtraPrice,
  onToggle,
  onConfirm,
  onClose,
}: ModifierDialogProps) {
  return (
    <Dialog open={!!modifierDialogItem} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {modifierDialogItem?.image && (
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                <img src={modifierDialogItem.image} alt={modifierDialogItem.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <p>{modifierDialogItem?.name}</p>
              <p className="text-sm font-normal text-muted-foreground">€{(modifierDialogItem?.price || 0).toFixed(2)}</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-4 pr-3">
            {modifierDialogItem?.modifierGroups.map((mg: ModifierGroupType) => (
              <div key={mg.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{mg.modifierGroup.name}</span>
                  {mg.modifierGroup.required && <Badge variant="destructive" className="text-[9px] h-4 px-1">Obvezno</Badge>}
                  {mg.modifierGroup.maxSelect && <span className="text-[10px] text-muted-foreground">(max {mg.modifierGroup.maxSelect})</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mg.modifierGroup.modifiers.map(mod => {
                    const isSelected = selectedModifiers.has(mod.id)
                    return (
                      <button
                        key={mod.id}
                        onClick={() => onToggle(mg.modifierGroup, mod)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-card-foreground border-border hover:bg-accent'
                        }`}
                      >
                        {mod.name}{mod.price > 0 ? ` +€${mod.price.toFixed(2)}` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} autoFocus>Prekliči</Button>
          <Button onClick={onConfirm}>
            <Check className="h-4 w-4 mr-1" />
            Potrdi €{((modifierDialogItem?.price || 0) + modifierExtraPrice).toFixed(2)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

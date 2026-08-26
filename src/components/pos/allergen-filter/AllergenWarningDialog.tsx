'use client'

// ─── Alergen opozorilo ob dodajanju ──────────────────────────────
import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertTriangle } from 'lucide-react'
import { EU_ALLERGENS } from './constants'
import type { AllergenWarningDialogProps } from './constants'

export const AllergenWarningDialog = memo(function AllergenWarningDialog({
  open,
  onClose,
  onConfirm,
  itemName,
  allergens,
  guestAllergens,
}: AllergenWarningDialogProps) {
  if (!allergens || guestAllergens.length === 0) return null

  const itemCodes = allergens.split(',').map(s => s.trim()).filter(Boolean)
  const conflicting = itemCodes.filter(code => guestAllergens.includes(code))

  if (conflicting.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Opozorilo: Alergeni!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">
            Artikel <strong>&quot;{itemName}&quot;</strong> vsebuje alergene, ki so označeni pri gostu:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {conflicting.map(code => {
              const info = EU_ALLERGENS.find(a => a.code === code)
              return (
                <Badge key={code} className="bg-red-100 text-red-700 border-red-300 text-xs gap-1">
                  <span>{info?.icon}</span>
                  {info?.name?.split(' ').slice(0, 3).join(' ')}
                </Badge>
              )
            })}
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-xs text-red-700 dark:text-red-400">
              Gost ima zabeležene alergene. Ali želite vseeno dodati ta artikel?
              Priporočamo, da gosta opozorite na vsebnost alergenov.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} autoFocus>Prekliči</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onClose() }}>
            Dodaj vseeno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

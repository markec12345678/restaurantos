'use client'

// ============================================
// DIALOG ZA ODPRITJE IZMENE
// ============================================

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Unlock } from 'lucide-react'
import type { OpenShiftFormType } from './constants'

interface OpenShiftDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  form: OpenShiftFormType
  onFormChange: (_form: OpenShiftFormType) => void
  employees: Array<{ id: string; name: string; role: string; status: string }>
  onSubmit: (_form: OpenShiftFormType) => void
  isPending: boolean
}

export const OpenShiftDialog = memo(function OpenShiftDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  employees,
  onSubmit,
  isPending,
}: OpenShiftDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5" />
            Odpri novo izmeno
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="cash-employee" className="text-sm font-medium">Zaposleni</label>
            <Select
              value={form.employeeId}
              onValueChange={(v) => {
                const emp = employees.find(e => e.id === v)
                onFormChange({ ...form, employeeId: v, employeeName: emp?.name || '' })
              }}
            >
              <SelectTrigger id="cash-employee" autoFocus className="pointer-coarse:h-11 pointer-coarse:text-base touch-manipulation">
                <SelectValue placeholder="Izberi zaposlenega" />
              </SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.status === 'active').map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="cash-starting" className="text-sm font-medium">Začetna gotovina (&euro;)</label>
            <DecimalInput
              id="cash-starting"
              value={form.startingCash}
              onValueChange={n => onFormChange({ ...form, startingCash: String(n) })}
              placeholder="200.00"
            />
            <p className="text-xs text-muted-foreground mt-1">Vnesite znesek gotovine v blagajni ob odprtju</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} aria-label="Prekliči" className="pointer-coarse:h-11 pointer-coarse:text-base">Prekliči</Button>
          <Button onClick={() => onSubmit(form)} disabled={isPending} aria-label="Odpri izmeno" className="pointer-coarse:h-11 pointer-coarse:text-base">
            {isPending ? 'Odpiram...' : 'Odpri izmeno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

'use client'

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User } from 'lucide-react'
import type { AssignDriverDialogProps } from './constants'

// ============================================
// ASSIGN DRIVER DIALOG - Dodelitev voznika dostavi
// ============================================
export const AssignDriverDialog = memo(function AssignDriverDialog({
  open,
  onOpenChange,
  driverName,
  onDriverNameChange,
  driverPhone,
  onDriverPhoneChange,
  vehicleInfo,
  onVehicleInfoChange,
  isPending,
  onAssign,
}: AssignDriverDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodeli voznika</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="driver-name" className="text-sm font-medium">Ime voznika</label>
            <Input id="driver-name" value={driverName} onChange={e => onDriverNameChange(e.target.value)} placeholder="Janez Novak" className="mt-1" aria-label="Ime voznika" autoFocus />
          </div>
          <div>
            <label htmlFor="driver-phone" className="text-sm font-medium">Telefon</label>
            <Input id="driver-phone" value={driverPhone} onChange={e => onDriverPhoneChange(e.target.value)} placeholder="+386 31 234 567" className="mt-1" aria-label="Telefon voznika" />
          </div>
          <div>
            <label htmlFor="driver-vehicle" className="text-sm font-medium">Vozilo</label>
            <Input id="driver-vehicle" value={vehicleInfo} onChange={e => onVehicleInfoChange(e.target.value)} placeholder="Rdeč Fiat 500, LJ-123-AB" className="mt-1" aria-label="Vozilo" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onAssign} disabled={isPending || !driverName || !driverPhone}>
            <User className="h-4 w-4 mr-2" />
            Dodeli
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

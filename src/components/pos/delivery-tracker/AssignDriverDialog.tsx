'use client'

import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface AssignDriverDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  driverName: string
  onDriverNameChange: (_v: string) => void
  driverPhone: string
  onDriverPhoneChange: (_v: string) => void
  vehicleInfo: string
  onVehicleInfoChange: (_v: string) => void
  isPending: boolean
  onAssign: () => void
}

export const AssignDriverDialog = memo(function AssignDriverDialog({
  open, onOpenChange, driverName, onDriverNameChange,
  driverPhone, onDriverPhoneChange, vehicleInfo, onVehicleInfoChange,
  isPending, onAssign,
}: AssignDriverDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodeli voznika</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Ime voznika" value={driverName} onChange={e => onDriverNameChange(e.target.value)} />
          <Input placeholder="Telefon" value={driverPhone} onChange={e => onDriverPhoneChange(e.target.value)} />
          <Input placeholder="Vozilo" value={vehicleInfo} onChange={e => onVehicleInfoChange(e.target.value)} />
          <Button onClick={onAssign} disabled={isPending}>Dodeli</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})

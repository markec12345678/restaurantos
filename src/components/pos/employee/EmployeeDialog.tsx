'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { EmployeeDialogProps } from './constants'

// ============================================
// DIJALOG ZAPOSLENI — Ustvari/uredi zaposlenega
// ============================================

export const EmployeeDialog = memo(function EmployeeDialog({
  open,
  onOpenChange,
  editingEmployee,
  formData,
  onFormDataChange,
  onSubmit,
}: EmployeeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingEmployee ? 'Uredi zaposlenega' : 'Dodaj zaposlenega'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="emp-name">Ime</Label><Input id="emp-name" value={formData.name} onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })} autoFocus /></div>
          <div><Label htmlFor="emp-email">E-pošta</Label><Input id="emp-email" type="email" value={formData.email} onChange={(e) => onFormDataChange({ ...formData, email: e.target.value })} /></div>
          <div><Label htmlFor="emp-phone">Telefon</Label><Input id="emp-phone" value={formData.phone} onChange={(e) => onFormDataChange({ ...formData, phone: e.target.value })} /></div>
          <div><Label htmlFor="emp-role">Vloga</Label>
            <Select value={formData.role} onValueChange={(v) => onFormDataChange({ ...formData, role: v })}>
              <SelectTrigger id="emp-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Skrbnik</SelectItem>
                <SelectItem value="manager">Vodja</SelectItem>
                <SelectItem value="staff">Osebje</SelectItem>
                <SelectItem value="chef">Kuhar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="emp-hiredate">Datum zaposlitve</Label><Input id="emp-hiredate" type="date" value={formData.hireDate} onChange={(e) => onFormDataChange({ ...formData, hireDate: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!formData.name || !formData.email}>{editingEmployee ? 'Posodobi' : 'Ustvari'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

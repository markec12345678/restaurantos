'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { type TableFormData } from './constants'

// --- Props ---

interface TableFormDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  editingTable: Record<string, unknown> | null
  formData: TableFormData
  onFormDataChange: (_data: TableFormData) => void
  onSubmit: () => void
}

// --- Komponenta: Dijalog za dodajanje/urejanje mize ---

export const TableFormDialog = memo(function TableFormDialog({
  open,
  onOpenChange,
  editingTable,
  formData,
  onFormDataChange,
  onSubmit,
}: TableFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingTable ? 'Uredi mizo' : 'Dodaj mizo'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="table-number" className="text-sm font-medium">Številka mize</label>
            <DecimalInput
              id="table-number"
              value={formData.number}
              onValueChange={(n) => onFormDataChange({ ...formData, number: String(n) })}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="table-capacity" className="text-sm font-medium">Kapaciteta</label>
            <DecimalInput
              id="table-capacity"
              value={formData.capacity}
              onValueChange={(n) => onFormDataChange({ ...formData, capacity: String(n) })}
            />
          </div>
          <div>
            <label htmlFor="table-area" className="text-sm font-medium">Območje</label>
            <Select value={formData.area} onValueChange={(v) => onFormDataChange({ ...formData, area: v })}>
              <SelectTrigger id="table-area">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Glavna dvorana</SelectItem>
                <SelectItem value="patio">Terasa</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="private">Zasebni prostor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="table-status" className="text-sm font-medium">Status</label>
            <Select value={formData.status} onValueChange={(v) => onFormDataChange({ ...formData, status: v })}>
              <SelectTrigger id="table-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Prosta</SelectItem>
                <SelectItem value="occupied">Zasedena</SelectItem>
                <SelectItem value="reserved">Rezervirana</SelectItem>
                <SelectItem value="cleaning">Čiščenje</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!formData.number}>
            {editingTable ? 'Posodobi' : 'Ustvari'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

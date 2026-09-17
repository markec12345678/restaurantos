'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, LayoutGrid } from 'lucide-react'
import type { TableDialogProps } from './constants'

// Dialog za dodajanje/urejanje mize
export const TableDialog = memo(function TableDialog({
  dialogOpen,
  editingTable,
  formData,
  onOpenChange,
  onSetFormData,
  onSubmit,
  onAreaChange,
  onShapeChange,
  onStatusChange,
}: TableDialogProps) {
  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            {editingTable ? `Uredi mizo ${editingTable.number}` : 'Dodaj mizo'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="floor-table-number" className="text-sm font-medium">Številka mize</label>
              <DecimalInput id="floor-table-number" value={formData.number} onValueChange={n => onSetFormData(prev => ({ ...prev, number: String(n) }))} autoFocus />
            </div>
            <div>
              <label htmlFor="floor-table-capacity" className="text-sm font-medium">Kapaciteta</label>
              <DecimalInput id="floor-table-capacity" value={formData.capacity} onValueChange={n => onSetFormData(prev => ({ ...prev, capacity: String(n) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="floor-table-area" className="text-sm font-medium">Območje</label>
              <Select value={formData.area} onValueChange={onAreaChange}>
                <SelectTrigger id="floor-table-area"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Glavna dvorana</SelectItem>
                  <SelectItem value="patio">Terasa</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="private">Zasebni prostor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="floor-table-shape" className="text-sm font-medium">Oblika</label>
              <Select value={formData.shape} onValueChange={onShapeChange}>
                <SelectTrigger id="floor-table-shape"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round">Okrogla</SelectItem>
                  <SelectItem value="square">Kvadratna</SelectItem>
                  <SelectItem value="rectangular">Pravokotna</SelectItem>
                  <SelectItem value="booth">Loža</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="floor-table-width" className="text-sm font-medium">Širina (%)</label>
              <DecimalInput id="floor-table-width" value={formData.width} onValueChange={n => onSetFormData(prev => ({ ...prev, width: String(n) }))} />
            </div>
            <div>
              <label htmlFor="floor-table-height" className="text-sm font-medium">Višina (%)</label>
              <DecimalInput id="floor-table-height" value={formData.height} onValueChange={n => onSetFormData(prev => ({ ...prev, height: String(n) }))} />
            </div>
          </div>
          <div>
            <label htmlFor="floor-table-status" className="text-sm font-medium">Status</label>
            <Select value={formData.status} onValueChange={onStatusChange}>
              <SelectTrigger id="floor-table-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Prosta</SelectItem>
                <SelectItem value="occupied">Zasedena</SelectItem>
                <SelectItem value="reserved">Rezervirana</SelectItem>
                <SelectItem value="cleaning">Čiščenje</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!formData.number}>
            {editingTable ? 'Posodobi' : <><Plus className="h-4 w-4 mr-1.5" />Ustvari</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

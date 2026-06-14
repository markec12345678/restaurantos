'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, AlertTriangle, ShieldCheck } from 'lucide-react'
import { categoryConfig, statusConfig } from './constants'
import type { HaccpEntry, HaccpFormData } from './types'

interface HaccpEntryDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  editingEntry: HaccpEntry | null
  formData: HaccpFormData
  setFormData: React.Dispatch<React.SetStateAction<HaccpFormData>>
  onSave: () => void
  isCreatePending: boolean
  isUpdatePending: boolean
}

export const HaccpEntryDialog = memo(function HaccpEntryDialog({
  open,
  onOpenChange,
  editingEntry,
  formData,
  setFormData,
  onSave,
  isCreatePending,
  isUpdatePending,
}: HaccpEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) { onOpenChange(false) } else { onOpenChange(true) } }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {editingEntry ? 'Uredi HACCP vnos' : 'Nov HACCP vnos'}
          </DialogTitle>
          <DialogDescription>
            {editingEntry
              ? 'Posodobite podatke obstoječega HACCP vnosa.'
              : 'Vnesite novo kontrolo ali meritev v HACCP dnevnik.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kategorija */}
          <div className="space-y-1.5">
            <Label htmlFor="haccp-category" className="text-sm font-semibold">Kategorija *</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, category: v }))}
            >
              <SelectTrigger autoFocus id="haccp-category">
                <SelectValue placeholder="Izberite kategorijo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Naslov */}
          <div className="space-y-1.5">
            <Label htmlFor="haccp-title" className="text-sm font-semibold">Naslov vnosa *</Label>
            <Input
              id="haccp-title"
              placeholder="npr. Hladilnik - kontrola temperature"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          {/* Vrednost/Meritev in Status - vzporedno */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="haccp-value" className="text-sm font-semibold">Meritev/Vrednost</Label>
              <Input
                id="haccp-value"
                placeholder="npr. 4.2°C"
                value={formData.value}
                onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="haccp-status" className="text-sm font-semibold">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}
              >
                <SelectTrigger id="haccp-status">
                  <SelectValue placeholder="Izberite status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${cfg.dotColor}`} aria-hidden="true" />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Korektivni ukrep - poudarjen ko je warning/critical */}
          {(formData.status === 'warning' || formData.status === 'critical') && (
            <div className="space-y-1.5">
              <div className={`rounded-lg p-2.5 ${statusConfig[formData.status].bgColor} border ${statusConfig[formData.status].borderColor}`} role="alert" id="haccp-corrective-warning">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className={`h-3.5 w-3.5 ${statusConfig[formData.status].color}`} />
                  <span className={`text-xs font-semibold ${statusConfig[formData.status].color}`}>
                    {formData.status === 'critical'
                      ? 'Kritično! Korektivni ukrep je obvezen!'
                      : 'Opozorilo! Vnesite korektivni ukrep.'}
                  </span>
                </div>
              </div>
              <Label htmlFor="haccp-corrective" className="text-sm font-semibold">Korektivni ukrep</Label>
              <Textarea
                id="haccp-corrective"
                placeholder="Opišite ukrepe, ki so bili izvedeni za odpravo nepravilnosti..."
                value={formData.correctiveAction}
                onChange={(e) => setFormData((prev) => ({ ...prev, correctiveAction: e.target.value }))}
                rows={3}
                aria-describedby="haccp-corrective-warning"
              />
            </div>
          )}

          {/* Opis */}
          <div className="space-y-1.5">
            <Label htmlFor="haccp-description" className="text-sm font-semibold">Opis</Label>
            <Textarea
              id="haccp-description"
              placeholder="Podrobnejši opis kontrole ali meritve..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Zaposleni */}
          <div className="space-y-1.5">
            <Label htmlFor="haccp-employee" className="text-sm font-semibold">Zaposleni *</Label>
            <Input
              id="haccp-employee"
              placeholder="Ime in priimek osebe, ki izvaja kontrolo"
              value={formData.employeeName}
              onChange={(e) => setFormData((prev) => ({ ...prev, employeeName: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Prekliči
          </Button>
          <Button
            onClick={onSave}
            disabled={
              !formData.title.trim() ||
              !formData.employeeName.trim() ||
              isCreatePending ||
              isUpdatePending
            }
          >
            {isCreatePending || isUpdatePending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {editingEntry ? 'Posodabljam...' : 'Vnašam...'}
              </>
            ) : editingEntry ? (
              'Posodobi vnos'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Dodaj vnos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

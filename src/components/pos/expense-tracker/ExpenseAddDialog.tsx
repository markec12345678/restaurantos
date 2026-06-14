'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { CATEGORIES, PAYMENT_METHODS } from './constants'

// ============================================
// DIALOG ZA DODAJANJE NOVEGA STROŠKA
// ============================================

interface ExpenseAddDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  form: {
    category: string
    description: string
    amount: string
    vendor: string
    paymentMethod: string
    recurring: boolean
  }
  setForm: React.Dispatch<React.SetStateAction<{
    category: string
    description: string
    amount: string
    vendor: string
    paymentMethod: string
    recurring: boolean
  }>>
  onSubmit: () => void
  isPending: boolean
}

export const ExpenseAddDialog = memo(function ExpenseAddDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isPending,
}: ExpenseAddDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Nov strošek</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="exp-category">Kategorija</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger id="exp-category" autoFocus><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="exp-description">Opis</Label>
            <Input id="exp-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opis stroška" aria-label="Opis stroška" />
          </div>
          <div>
            <Label htmlFor="exp-amount">Znesek (€)</Label>
            <Input id="exp-amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" aria-label="0.00" />
          </div>
          <div>
            <Label htmlFor="exp-vendor">Dobavitelj</Label>
            <Input id="exp-vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Ime dobavitelja" aria-label="Ime dobavitelja" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="exp-payment">Način plačila</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger id="exp-payment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input id="exp-recurring" type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} className="rounded" />
              <Label htmlFor="exp-recurring" className="text-sm">Ponavljajoč</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!form.description || !form.amount || isPending}>Dodaj</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

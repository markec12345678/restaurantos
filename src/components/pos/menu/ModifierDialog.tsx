'use client'

import { memo, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Pencil, Plus, Trash2, Layers, Search, X, Paperclip } from 'lucide-react'
import { formatEUR } from '@/lib/safe-format'
import { slCount, ARTIKEL_FORMS } from '@/lib/sl-plural'
import type { ModifierDialogProps, ModifierRowState } from './constants'

// ============================================
// DIALOG ZA SKUPINO DODATKOV — ustvarjanje IN urejanje (RUNDA 68)
// Urejevalni način: naslov "Uredi skupino", gumb "Shrani spremembe".
// DINAMIČNE VRSTICE modifikatorjev (ime + cena) z dodajanjem/odstranjevanjem,
// Obvezno stikalo + min/max omejitve izbire, ŽIVI PREDOGLED opcij s cenami.
// PUT API zamenja celoten nabor modifierjev (transakcija) — urejanje vrstic
// torej pravilno preimenuje/doda/odstrani opcije v enem koraku.
// RUNDA 70: group-side attach — iskalni seznam artiklov z checkboxi
// (menuItemIds → API zamenja celoten nabor vezav v transakciji).
// ============================================
export const ModifierDialog = memo(function ModifierDialog({
  open,
  onOpenChange,
  modGroupForm,
  onModGroupFormChange,
  editingModifierGroup,
  menuItems,
  onSubmit,
}: ModifierDialogProps) {
  const isEditing = !!editingModifierGroup
  const [itemSearch, setItemSearch] = useState('')

  const toggleItem = (id: string) => {
    onModGroupFormChange({
      ...modGroupForm,
      menuItemIds: modGroupForm.menuItemIds.includes(id)
        ? modGroupForm.menuItemIds.filter((x) => x !== id)
        : [...modGroupForm.menuItemIds, id],
    })
  }

  // RUNDA 70: filtriran seznam artiklov za attach (cap 50 vrstic za hitrost)
  const matchedItems = useMemo(() => {
    const items = Array.isArray(menuItems) ? menuItems : []
    const q = itemSearch.trim().toLowerCase()
    const filtered = q
      ? items.filter((it) => String(it.name ?? '').toLowerCase().includes(q))
      : items
    return { filtered, total: items.length, capped: filtered.slice(0, 50) }
  }, [menuItems, itemSearch])

  const setRow = (idx: number, patch: Partial<ModifierRowState>) => {
    onModGroupFormChange({
      ...modGroupForm,
      modifiers: modGroupForm.modifiers.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    })
  }

  const addRow = () => {
    onModGroupFormChange({ ...modGroupForm, modifiers: [...modGroupForm.modifiers, { name: '', price: '' }] })
  }

  const removeRow = (idx: number) => {
    onModGroupFormChange({
      ...modGroupForm,
      modifiers: modGroupForm.modifiers.length > 1
        ? modGroupForm.modifiers.filter((_, i) => i !== idx)
        : [{ name: '', price: '' }],
    })
  }

  const filledCount = modGroupForm.modifiers.filter((m) => m.name.trim() !== '').length
  const canSubmit = modGroupForm.name.trim() !== '' && filledCount > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing
              ? (<><Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Uredi skupino dodatkov</>)
              : (<><Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Dodaj skupino dodatkov</>)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Živi predogled — značke skupine + opcije s cenami */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Layers className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{modGroupForm.name || (isEditing ? 'Brez imena' : 'Nova skupina')}</p>
                <p className="text-xs text-muted-foreground">
                  {filledCount === 0 ? 'brez opcij' : `${filledCount} ${filledCount === 1 ? 'opcija' : filledCount === 2 ? 'opciji' : filledCount <= 4 ? 'opcije' : 'opcij'}`}
                  {modGroupForm.required && ' · obvezna'}
                  {modGroupForm.maxSelect && ` · max ${modGroupForm.maxSelect}`}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground ml-auto shrink-0">Predogled</p>
            </div>
            {filledCount > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                {modGroupForm.modifiers.filter((m) => m.name.trim() !== '').map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
                    {m.name}
                    {parseFloat(m.price) > 0 && <span className="font-medium text-primary">+{formatEUR(parseFloat(m.price))}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="modgroup-name">Ime skupine</Label>
            <Input
              id="modgroup-name"
              placeholder="npr. Način pečenja, Priloge, Dodatki"
              value={modGroupForm.name}
              onChange={(e) => onModGroupFormChange({ ...modGroupForm, name: e.target.value })}
              autoFocus
            />
          </div>

          {/* Obvezno stikalo + min/max — smiselne omejitve izbire */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="modgroup-required" className="text-sm">Obvezna izbira</Label>
                <p className="text-xs text-muted-foreground">Kupec mora izbrati vsaj eno opcijo pred potrditvijo</p>
              </div>
              <Switch
                id="modgroup-required"
                checked={modGroupForm.required}
                onCheckedChange={(checked) => onModGroupFormChange({ ...modGroupForm, required: checked })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="modgroup-min" className="text-sm">Min. izbira</Label>
                <Input
                  id="modgroup-min"
                  type="number"
                  min={0}
                  max={50}
                  value={modGroupForm.minSelect}
                  onChange={(e) => onModGroupFormChange({ ...modGroupForm, minSelect: e.target.value })}
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label htmlFor="modgroup-max" className="text-sm">Max. izbira</Label>
                <Input
                  id="modgroup-max"
                  type="number"
                  min={0}
                  max={50}
                  placeholder="neomejeno"
                  value={modGroupForm.maxSelect}
                  onChange={(e) => onModGroupFormChange({ ...modGroupForm, maxSelect: e.target.value })}
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          {/* ═══ RUNDA 70: Pripni artikle — iskalni seznam z checkboxi ═══ */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Pripni artikle
              </Label>
              <span
                className={"text-xs tabular-nums " + (modGroupForm.menuItemIds.length > 0 ? 'font-medium text-primary' : 'text-muted-foreground')}
                aria-live="polite"
              >
                {modGroupForm.menuItemIds.length > 0
                  ? slCount(modGroupForm.menuItemIds.length, ARTIKEL_FORMS) + ' izbranih'
                  : 'ni izbranih'}
              </span>
            </div>

            {/* Izbrani čipi z X odstranitvijo */}
            {modGroupForm.menuItemIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {modGroupForm.menuItemIds.map((id) => {
                  const it = (menuItems || []).find((m) => String(m.id) === id)
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border bg-primary/5 px-2 py-0.5 text-xs font-medium"
                    >
                      {String(it?.name ?? 'artikel')}
                      <button
                        type="button"
                        onClick={() => toggleItem(id)}
                        aria-label={"Odpni " + String(it?.name ?? 'artikel')}
                        className="rounded-full hover:bg-muted-foreground/15 transition"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 left-2.5 my-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Išči artikel po imenu…"
                aria-label="Išči artikel za pripetitev"
                className="pl-8 h-8 text-sm"
              />
            </div>

            {matchedItems.total === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Ni artiklov — ustvari jih v zavihku Artikli
              </p>
            ) : matchedItems.filtered.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Ni zadetkov za „{itemSearch.trim()}“
              </p>
            ) : (
              <>
                <div
                  role="group"
                  aria-label="Artikli za pripetitev"
                  className="max-h-48 space-y-1 overflow-y-auto pr-1"
                >
                  {matchedItems.capped.map((it) => {
                    const id = String(it.id ?? '')
                    const checked = modGroupForm.menuItemIds.includes(id)
                    return (
                      <label
                        key={id}
                        className={
                          'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition ' +
                          (checked
                            ? 'border-primary/50 bg-primary/5 font-medium'
                            : 'border-border hover:border-primary/30 hover:bg-accent/50')
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(id)}
                          className="h-3.5 w-3.5 rounded accent-primary"
                        />
                        <span className="min-w-0 flex-1 truncate">{String(it.name ?? '')}</span>
                      </label>
                    )
                  })}
                </div>
                {matchedItems.filtered.length > 50 && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Prikazanih 50 od {matchedItems.filtered.length} — izklopi iskanje za ostale
                  </p>
                )}
              </>
            )}
          </div>

          {/* Dinamične vrstice opcij */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Opcije</Label>
              <span className="text-xs text-muted-foreground">Cena 0 = brez doplačila</span>
            </div>
            {modGroupForm.modifiers.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder={`Opcija ${idx + 1} (npr. Srednje pečeno)`}
                  value={row.name}
                  onChange={(e) => setRow(idx, { name: e.target.value })}
                  aria-label={`Ime opcije ${idx + 1}`}
                  className="flex-1"
                />
                <div className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">€</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0,00"
                    value={row.price}
                    onChange={(e) => setRow(idx, { price: e.target.value })}
                    aria-label={`Doplačilo opcije ${idx + 1}`}
                    className="pl-6 text-right"
                    inputMode="decimal"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(idx)}
                  aria-label={`Odstrani opcijo ${idx + 1}${row.name ? ` (${row.name})` : ''}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Dodaj opcijo
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {isEditing ? 'Shrani spremembe' : 'Ustvari skupino'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

'use client'

import { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus, Pencil, Trash2, Layers, ShieldAlert, PackageOpen,
} from 'lucide-react'
import { slCount, OPCIJA_FORMS, ARTIKEL_FORMS } from '@/lib/sl-plural'
import { canDeleteModifierGroup } from '@/lib/modifier-guard'
import type { ModifiersTabProps, ModifierGroupData } from './constants'
import { formatEUR } from '@/lib/safe-format'

// ============================================
// TAB DODATKOV (modifier groups)
// RUNDA 68: DODAJ + UREDI + IZBRIŠI (AlertDialog s števecem pripetih
// artiklov — izbris je blokiran ko je skupina v uporabi) + poliš:
// barvni akcent trak z indeksom, ikonska ploščica, čip "N opcij"
// (prave sklanjatve), badge "pri N artiklih", hover-dejanja (na dotiku
// vedno vidna), prazno stanje s CTA.
// ============================================
// Barvna paleta akcentov — kroži po indeksu (2 barvi prej sta bili pomešani)
const ACCENTS = ['#f59e0b', '#0ea5e9', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1']

export const ModifiersTab = memo(function ModifiersTab({
  modifierGroups,
  onAddGroup,
  onEditGroup,
  onConfirmDelete,
}: ModifiersTabProps) {
  // FIX TypeError: b?.filter is not a function — modifierGroups je lahko undefined
  const groups = Array.isArray(modifierGroups) ? modifierGroups : []
  // RUNDA 68: kandidat za izbris (AlertDialog potrditev pred mutacijo)
  const [deleteTarget, setDeleteTarget] = useState<ModifierGroupData | null>(null)

  const deleteTargetCount = deleteTarget
    ? (Array.isArray(deleteTarget.menuItems) ? deleteTarget.menuItems.length : 0)
    : 0
  const deleteDecision = canDeleteModifierGroup(deleteTargetCount)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Skupine dodatkov se prikažejo ob kliku na artikel — urejanje je živo
          (izbris je mogoč samo za skupino, ki ni pripeta nobenemu artiklu).
        </p>
        <Button onClick={onAddGroup}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj skupino
        </Button>
      </div>
      {groups.length === 0 ? (
        /* Prazno stanje — CTA namesto praznega prostora */
        <button
          type="button"
          onClick={onAddGroup}
          className="group w-full rounded-xl border border-dashed border-muted-foreground/30 p-8 flex flex-col items-center gap-2 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PackageOpen className="h-10 w-10 transition-transform group-hover:scale-110" aria-hidden="true" />
          <span className="text-sm font-medium">Ni še nobene skupine dodatkov</span>
          <span className="text-xs">Klikni, da dodaš prvo (npr. „Način pečenja" ali „Priloge")</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((mg, idx) => {
            // FIX: Array.isArray za mg.modifiers in mg.menuItems
            const modifiers = Array.isArray(mg.modifiers) ? mg.modifiers : []
            const menuItems = Array.isArray(mg.menuItems) ? mg.menuItems : []
            const accent = ACCENTS[idx % ACCENTS.length]
            const totalSurcharge = modifiers.reduce((sum, m) => sum + (Number(m.price) || 0), 0)
            return (
              <Card
                key={mg.id}
                className="group relative overflow-hidden hover:shadow-md transition-all hover:border-primary/30"
              >
                {/* Barvni akcent trak (levo, celotna višina) */}
                <div
                  className="absolute inset-y-0 left-0 w-1.5"
                  style={{ backgroundColor: accent }}
                  aria-hidden="true"
                />
                <CardContent className="p-4 pl-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Ikonska ploščica z hover skaliranjem */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
                        style={{ backgroundColor: `${accent}20` }}
                      >
                        <Layers className="h-5 w-5" style={{ color: accent }} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate" title={mg.name}>{mg.name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {mg.required && <Badge variant="destructive" className="text-[9px] h-4 px-1">Obvezno</Badge>}
                          {mg.maxSelect !== null && mg.maxSelect !== undefined && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">Max {mg.maxSelect}</Badge>
                          )}
                          {!mg.required && mg.minSelect === 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1">Izbirno</Badge>}
                        </div>
                      </div>
                    </div>
                    {/* Dejanja: hover (desktop) / vedno (dotik) — aria-label obvezna */}
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        aria-label={`Uredi skupino dodatkov ${mg.name}`}
                        onClick={() => onEditGroup(mg as unknown as Record<string, unknown>)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Izbriši skupino dodatkov ${mg.name}${menuItems.length > 0 ? ` (blokirano — pripeta ${slCount(menuItems.length, ARTIKEL_FORMS)})` : ''}`}
                        onClick={() => setDeleteTarget(mg)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {/* Števci: opcije (prave sklanjatve) + pripeti artikli */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 text-xs tabular-nums" style={{ borderColor: `${accent}60` }}>
                      {slCount(modifiers.length, OPCIJA_FORMS)}
                    </Badge>
                    <Badge
                      variant={menuItems.length === 0 ? 'secondary' : 'outline'}
                      className="gap-1 text-xs tabular-nums"
                    >
                      {menuItems.length === 0
                        ? 'ni pripeta'
                        : `pripeta ${slCount(menuItems.length, ARTIKEL_FORMS)}`}
                    </Badge>
                    {totalSurcharge > 0 && (
                      <Badge variant="secondary" className="text-xs tabular-nums">
                        doplačila do {formatEUR(totalSurcharge)}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    {modifiers.map((mod) => (
                      <div key={mod.id} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-sm">
                        <span className="truncate">{mod.name}</span>
                        {mod.price > 0 && <span className="text-primary font-medium shrink-0">+{formatEUR(mod.price)}</span>}
                      </div>
                    ))}
                  </div>
                  {menuItems.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Uporabljeno pri:</p>
                      <div className="flex flex-wrap gap-0.5">
                        {menuItems.map((mi) => (
                          <Badge key={mi.menuItem.id} variant="outline" className="text-[9px] h-4 px-1">
                            {mi.menuItem.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* RUNDA 68: potrditev brisanja — blokada ko je skupina pripeta artiklom.
          ENOTEN VIR z API-jem: canDeleteModifierGroup (modifier-guard). */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" aria-hidden="true" />
              Izbriši skupino „{deleteTarget?.name}“?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deleteTargetCount > 0 ? (
                  <>
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
                      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
                      <span>
                        Skupina je pripeta <strong>{slCount(deleteTargetCount, ARTIKEL_FORMS)}</strong> —
                        izbris je blokiran, sicer bi ti izgubili dodatke s teh
                        artiklov. Najprej odveži skupino v urejevalniku artiklov.
                      </span>
                    </div>
                    <p>Za varnost so vezave dodatkov na artikle vedno zaščitene pred brisanjem.</p>
                  </>
                ) : (
                  <p>
                    Skupina ni pripeta nobenemu artiklu. Dejanje je trajno — skupine
                    z vsemi opcijami ni mogoče obnoviti po izbrisu.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteDecision.allowed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) onConfirmDelete(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Izbriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})

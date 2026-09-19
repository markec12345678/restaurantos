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
  Plus, Pencil, Trash2, Package, FolderPlus, ShieldAlert, UtensilsCrossed,
} from 'lucide-react'
import { slCount, ARTIKEL_FORMS, KATEGORIJA_FORMS } from '@/lib/sl-plural'
import { canDeleteMenu } from '@/lib/menu-guard'
import type { MenusTabProps, MenuData, CategoryData } from './constants'

// ============================================
// TAB MENIJEV — RUNDA 67: uredi + izbriši (AlertDialog s števci in
// zaščito menu-guarda) + poliš: barvni trak, čipi z pravimi sklanjatvami,
// kategorije oblak s "+N" prelive, hover-dejanja, prazno stanje s CTA.
// ============================================

/** Največ kategorij prikazanih v oblaku — preostanek kot "+N" čip. */
const MAX_CATEGORY_BADGES = 6

export const MenusTab = memo(function MenusTab({
  menus,
  categories,
  onAddMenu,
  onEditMenu,
  onConfirmDelete,
}: MenusTabProps) {
  // FIX TypeError: b?.filter is not a function — categories in menus sta lahko objekti
  const menusArray = Array.isArray(menus) ? menus : []
  const categoriesArray = Array.isArray(categories) ? categories : []
  // RUNDA 67: kandidat za izbris (AlertDialog potrditev pred mutacijo)
  const [deleteTarget, setDeleteTarget] = useState<MenuData | null>(null)

  const deleteTargetCategories: CategoryData[] = deleteTarget
    ? categoriesArray.filter((c) => (c.menu?.id || c.menuId) === deleteTarget.id)
    : []
  const deleteTargetItems = deleteTargetCategories.reduce(
    (sum, c) => sum + (Array.isArray(c.menuItems) ? c.menuItems.length : 0),
    0
  )
  // ENOTEN VIR z API-jem: ista odločitev v dialogu kot v DELETE handlerju
  const deleteDecision = deleteTarget
    ? canDeleteMenu(deleteTargetCategories.length, deleteTargetItems)
    : null

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Meniji združujejo kategorije — urejanje in izbris sta živa
          (izbris je blokiran, dokler meni vsebuje artikle).
        </p>
        <Button onClick={onAddMenu}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj meni
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {menusArray.map((menu) => {
          const menuCategories = categoriesArray.filter((c) =>
            (c.menu?.id || c.menuId) === menu.id
          )
          const itemCount = menuCategories.reduce(
            (sum, c) => sum + (Array.isArray(c.menuItems) ? c.menuItems.length : 0),
            0
          )
          const visibleCategories = menuCategories.slice(0, MAX_CATEGORY_BADGES)
          const overflowCount = menuCategories.length - visibleCategories.length
          return (
            <Card
              key={menu.id}
              className="group relative overflow-hidden hover:shadow-md transition-all hover:border-primary/30"
            >
              {/* Barvni akcent trak menija (levo, celotna višina) */}
              <div
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ backgroundColor: menu.color }}
                aria-hidden="true"
              />
              <CardContent className="p-6 pl-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl transition-transform group-hover:scale-105"
                    style={{ backgroundColor: `${menu.color}20` }}
                  >
                    {menu.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg truncate" title={menu.name}>{menu.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {/* Aktivnost s piko — barvna semantika namesto besedila */}
                      <Badge
                        variant="outline"
                        className={menu.isActive
                          ? 'gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'gap-1.5 border-muted-foreground/30 bg-muted text-muted-foreground'}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${menu.isActive ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
                          aria-hidden="true"
                        />
                        {menu.isActive ? 'Aktiven' : 'Neaktiven'}
                      </Badge>
                      <Badge variant="outline" className="tabular-nums">
                        {menuCategories.length === 0
                          ? 'brez kategorij'
                          : slCount(menuCategories.length, KATEGORIJA_FORMS)}
                      </Badge>
                      <Badge variant="secondary" className="gap-1 text-xs tabular-nums">
                        <Package className="h-3 w-3" aria-hidden="true" />
                        {slCount(itemCount, ARTIKEL_FORMS)}
                      </Badge>
                    </div>
                  </div>
                  {/* Dejanja: hover (desktop) / vedno (dotik) — aria-label obvezna */}
                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label={`Uredi meni ${menu.name}`}
                      onClick={() => onEditMenu(menu as unknown as Record<string, unknown>)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Izbriši meni ${menu.name}${itemCount > 0 ? ` (blokirano — vsebuje ${slCount(itemCount, ARTIKEL_FORMS)})` : ''}`}
                      onClick={() => setDeleteTarget(menu)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {/* Kategorije oblak — prve 6 + "+N" prelive */}
                {menuCategories.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {visibleCategories.map((cat) => (
                      <Badge key={cat.id} variant="outline" className="text-xs">
                        {cat.icon} {cat.name}
                      </Badge>
                    ))}
                    {overflowCount > 0 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{overflowCount}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onAddMenu}
                    className="group/empty w-full rounded-lg border border-dashed border-muted-foreground/30 p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FolderPlus className="h-4 w-4 transition-transform group-hover/empty:scale-110" aria-hidden="true" />
                    Ta meni je brez kategorij — klikni, da dodaš prvo
                  </button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* RUNDA 67: potrditev brisanja — števci, blokada ko artikli > 0, opozorilo o kaskadi */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" aria-hidden="true" />
              Izbriši meni „{deleteTarget?.name}“?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deleteDecision && !deleteDecision.allowed ? (
                  <>
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
                      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
                      <span>{deleteDecision.messageSl}</span>
                    </div>
                    <p className="flex items-center gap-1.5">
                      <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Za varnost so živi podatki prodaje vedno zaščiteni pred brisanjem.
                    </p>
                  </>
                ) : (
                  <>
                    {deleteDecision?.cascadeWarning && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
                        <FolderPlus className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                        <span>{deleteDecision.confirmSl}</span>
                      </div>
                    )}
                    {deleteDecision && !deleteDecision.cascadeWarning && (
                      <p>{deleteDecision.confirmSl}</p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteDecision?.allowed}
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

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
  Plus, Pencil, Trash2, Package, FolderPlus, ShieldAlert,
} from 'lucide-react'
import { slCount, ARTIKEL_FORMS, KATEGORIJA_FORMS } from '@/lib/sl-plural'
import type { CategoriesTabProps, CategoryData } from './constants'

// ============================================
// TAB KATEGIJ - organizirane po meniju
// RUNDA 66: uredi + izbriši (AlertDialog s števcem artiklov) + poliš:
// barvni akcent trak, ikonska ploščica, čip "N artiklov" (slCount),
// hover-dejanja (na dotiku vedno vidna), prazno stanje po meniju s CTA.
// ============================================
export const CategoriesTab = memo(function CategoriesTab({
  menus,
  categories,
  onAddCategory,
  onEditCategory,
  onConfirmDelete,
}: CategoriesTabProps) {
  // FIX TypeError: b?.filter is not a function — categories in menus sta lahko
  // objekti (API vrača {items:[...]}) ne array-i. Optional chaining ne pompri
  // ker objekti nimajo .filter metode.
  const menusArray = Array.isArray(menus) ? menus : []
  const categoriesArray = Array.isArray(categories) ? categories : []
  // RUNDA 66: kandidat za izbris (AlertDialog potrditev pred mutacijo)
  const [deleteTarget, setDeleteTarget] = useState<CategoryData | null>(null)

  const deleteTargetCount = deleteTarget
    ? (Array.isArray(deleteTarget.menuItems) ? deleteTarget.menuItems.length : 0)
    : 0

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Kategorije so razporejene po menijih — urejanje in izbris sta živa
          (izbris je mogoč samo za prazno kategorijo).
        </p>
        <Button onClick={onAddCategory}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj kategorijo
        </Button>
      </div>
      {menusArray.map((menu) => {
        const menuCategories = categoriesArray.filter((c) =>
          (c.menu?.id || c.menuId) === menu.id
        )
        return (
          <div key={menu.id} className="space-y-3">
            {/* Glava menija: barvni trak + ime + gramatično pravilen števec */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 rounded-full" style={{ backgroundColor: menu.color }} />
              <h3 className="text-lg font-semibold">{menu.icon} {menu.name}</h3>
              <Badge variant="outline" className="tabular-nums">
                {menuCategories.length === 0
                  ? 'brez kategorij'
                  : slCount(menuCategories.length, KATEGORIJA_FORMS)}
              </Badge>
            </div>
            {menuCategories.length === 0 ? (
              /* Prazno stanje po meniju — CTA namesto praznega prostora */
              <button
                type="button"
                onClick={onAddCategory}
                className="group w-full rounded-xl border border-dashed border-muted-foreground/30 p-6 flex flex-col items-center gap-2 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FolderPlus className="h-8 w-8 transition-transform group-hover:scale-110" aria-hidden="true" />
                <span className="text-sm font-medium">Ta meni še nima kategorij</span>
                <span className="text-xs">Klikni, da dodaš prvo kategorijo</span>
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {menuCategories.map((cat) => {
                  const itemCount = Array.isArray(cat.menuItems) ? cat.menuItems.length : 0
                  return (
                    <Card
                      key={cat.id}
                      className="group relative overflow-hidden hover:shadow-md transition-all hover:border-primary/30"
                    >
                      {/* Barvni akcent trak kategorije (levo, celotna višina) */}
                      <div
                        className="absolute inset-y-0 left-0 w-1.5"
                        style={{ backgroundColor: cat.color }}
                        aria-hidden="true"
                      />
                      <CardContent className="p-4 pl-5 flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl transition-transform group-hover:scale-105"
                          style={{ backgroundColor: `${cat.color}20` }}
                        >
                          {cat.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" title={cat.name}>{cat.name}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <Badge
                              variant={itemCount === 0 ? 'secondary' : 'outline'}
                              className="gap-1 text-xs tabular-nums"
                            >
                              <Package className="h-3 w-3" aria-hidden="true" />
                              {slCount(itemCount, ARTIKEL_FORMS)}
                            </Badge>
                          </div>
                        </div>
                        {/* Dejanja: hover (desktop) / vedno (dotik) — aria-label obvezna */}
                        <div
                          className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            aria-label={`Uredi kategorijo ${cat.name}`}
                            onClick={() => onEditCategory(cat as unknown as Record<string, unknown>)}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Izbriši kategorijo ${cat.name}${itemCount > 0 ? ` (blokirano — vsebuje ${slCount(itemCount, ARTIKEL_FORMS)})` : ''}`}
                            onClick={() => setDeleteTarget(cat)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* RUNDA 66: potrditev brisanja — števec artiklov + blokada ko artikli > 0 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" aria-hidden="true" />
              Izbriši kategorijo „{deleteTarget?.name}“?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deleteTargetCount > 0 ? (
                  <>
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
                      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
                      <span>
                        Kategorija vsebuje <strong>{slCount(deleteTargetCount, ARTIKEL_FORMS)}</strong> —
                        izbris je blokiran. Artikle najprej premakni v drugo
                        kategorijo ali jih izbriši.
                      </span>
                    </div>
                    <p>Za varnost so živi podatki prodaje vedno zaščiteni pred brisanjem.</p>
                  </>
                ) : (
                  <p>
                    Kategorija je prazna. Dejanje je trajno — kategorije ni mogoče
                    obnoviti po izbrisu.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteTargetCount > 0}
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

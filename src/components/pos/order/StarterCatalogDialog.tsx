'use client'

// ============================================
// STARTER CATALOG DIALOG (issue #114) — izbiro tipa lokala + idempotentna
// uporaba starter kataloga na TRENUTNI lokaciji (POST /api/onboarding/
// starter-catalog). Pokaže se iz praznega POS kataloga (MenuItemsGrid).
// ============================================

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { VENUE_TYPES, type VenueType } from '@/lib/onboarding/catalog-templates'

interface StarterCatalogDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
}

interface ApplySummary {
  template: string
  categories: number
  items: number
  modifierGroups: number
  created: { categories: number; items: number; modifierGroups: number }
}

export function StarterCatalogDialog({ open, onOpenChange }: StarterCatalogDialogProps) {
  const queryClient = useQueryClient()
  const [venueType, setVenueType] = useState<VenueType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [existingConflict, setExistingConflict] = useState<number | null>(null)

  const selected = useMemo(
    () => VENUE_TYPES.find((t) => t.id === venueType) ?? null,
    [venueType],
  )

  const reset = () => {
    setVenueType(null)
    setSubmitting(false)
    setExistingConflict(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const invalidateCatalogQueries = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.menus.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.modifierGroups.all })
  }

  const applyCatalog = async (confirm = false) => {
    if (!venueType) return
    setSubmitting(true)
    setExistingConflict(null)
    try {
      const res = await authFetch('/api/onboarding/starter-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueType, confirm }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data?.existingItemCount != null) {
        // Lokacija že ima artikle — potrebna eksplicitna potrditev (issue #114 §8)
        setExistingConflict(Number(data.existingItemCount))
        return
      }
      if (!res.ok) {
        throw new Error(data?.error || 'Napaka pri ustvarjanju starter kataloga')
      }
      invalidateCatalogQueries()
      toast.success(
        `Starter katalog ustvarjen: ${data.created?.items ?? 0} novih artiklov, ${data.created?.categories ?? 0} kategorij.`,
        { description: 'Cene so primerne začetne vrednosti — uredite jih v Menu Managerju.' },
      )
      handleOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri ustvarjanju starter kataloga')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle>Starter katalog</DialogTitle>
          <DialogDescription>
            Izberite tip lokala — sistem pripravi kategorije, artikle in modifierje, da je POS takoj uporaben.
            {' '}Cene so primerne začetne vrednosti — uredite jih po vašem ceniku.
          </DialogDescription>
        </DialogHeader>

        {existingConflict != null ? (
          <div className="space-y-3">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ta lokacija že ima <strong>{existingConflict}</strong> artiklov. Starter katalog ne bo podvojil
                obstoječih (iste kategorije + ime se preskočijo), vendar ga uporabite samo, če to res želite.
              </AlertDescription>
            </Alert>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                Prekliči
              </Button>
              <Button onClick={() => applyCatalog(true)} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />}
                Vseeno uporabi starter katalog
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VENUE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setVenueType(t.id)}
                  aria-pressed={venueType === t.id}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    venueType === t.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-accent/50'
                  }`}
                >
                  <span className="text-xl" aria-hidden="true">{t.icon}</span>
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground">{t.categoryCount} kategorij · {t.itemCount} artiklov</span>
                </button>
              ))}
            </div>

            {selected && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>{selected.label}</strong>: {selected.description}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                Prekliči
              </Button>
              <Button onClick={() => applyCatalog(false)} disabled={!venueType || submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />}
                Ustvari starter katalog
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export type { ApplySummary }

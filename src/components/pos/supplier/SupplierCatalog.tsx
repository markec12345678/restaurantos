'use client'

// ============================================
// R131 (epic #115 P1-13) — KATALOG DOBAVITELJA (pack-size konverzije)
// Mounta se v razširjenem pogledu dobavitelja (SuppliersList, pariteta
// SupplierPriceHistory R130-b) — fetch /api/suppliers/[id]/catalog se
// zgodi šele ko je sekcija odprta (komponenta mounta samo v tem bloku).
//
// Kanon: dobavitelj prodaja v PAKETIH (vrečka 25 kg, sod 50 L), zaloga
// se vodi v OSNOVNIH enotah (kg, L, kos). baseUnitPrice = pricePerPack /
// packQty (iz API-ja; če manjka, defenzivno izračun na klientu —
// pack-format.ts, NIKOLI parseFloat).
//
// Kontrakt backend-a (R131-server, dizajn §3c — defenzivno, ker strežniška
// polovica teče vzporedno):
//   GET    /api/suppliers/[id]/catalog → { items: [...] }
//   POST   /api/suppliers/[id]/catalog (upsert po (supplierId, inventoryItemId))
//   DELETE /api/suppliers/[id]/catalog?catalogItemId= → { success: true }
// Cene prihajajo lahko kot STRINGI iz Decimal — vedno toNum('@/lib/decimal').
// Barve po hišni paleti: emerald/amber/red/zinc — BREZ modrih/indigo.
// ============================================

import { memo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Loader2, Package, Pencil, Plus, Power, RefreshCw, Trash2 } from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { toNum } from '@/lib/decimal'
import { formatEUR } from '@/lib/safe-format'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { isValidPack, fmtPackQty, baseUnitPriceFromPack } from './pack-format'

// --- Kontrakt GET /api/suppliers/[id]/catalog (defenzivni tipi) ---
export interface SupplierCatalogItem {
  id: string
  supplierSku?: string | null
  // Decimal STRINGI čez API mejo (ali numbers — obramba sprejme oboje)
  packQty?: number | string | null
  packUnit?: string | null
  pricePerPack?: number | string | null
  vatRate?: number | string | null
  minOrderPacks?: number | null
  isActive?: boolean
  note?: string | null
  baseUnitPrice?: number | string | null
  inventoryItem?: { id: string; name: string; unit?: string; costPerUnit?: number | string | null }
}

interface CatalogResponse {
  items?: SupplierCatalogItem[]
}

interface InventoryBriefItem {
  id: string
  name: string
  unit: string
}

interface SupplierCatalogProps {
  supplierId: string
  className?: string
}

interface CatalogFormState {
  inventoryItemId: string
  packQty: number
  packUnit: string
  pricePerPack: number
  vatRate: number
  minOrderPacks: number
  supplierSku: string
}

const EMPTY_FORM: CatalogFormState = {
  inventoryItemId: '',
  packQty: 1,
  packUnit: 'paket',
  pricePerPack: 0,
  vatRate: 0,
  minOrderPacks: 1,
  supplierSku: '',
}

export const SupplierCatalog = memo(function SupplierCatalog({ supplierId, className }: SupplierCatalogProps) {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  // null = dodajanje novega; objekt = urejanje obstoječe katalog vrstice
  const [editing, setEditing] = useState<SupplierCatalogItem | null>(null)
  const [form, setForm] = useState<CatalogFormState>(EMPTY_FORM)

  // --- katalog (fetch šele, ko je razširjen — komponenta mounta šele potem) ---
  const query = useQuery({
    queryKey: queryKeys.suppliers.catalog(supplierId),
    enabled: Boolean(supplierId),
    staleTime: 60000,
    queryFn: async (): Promise<CatalogResponse> => {
      const res = await authFetch(`/api/suppliers/${encodeURIComponent(supplierId)}/catalog`)
      if (!res.ok) throw new Error(`catalog ${res.status}`)
      return (await res.json()) as CatalogResponse
    },
  })

  // --- inventory items za izbiro v obrazcu (ISTI vir kot PurchaseOrderDialog:
  //     GET /api/inventory z deljenim queryKey 'inventory-brief' — reuse cache) ---
  const inventoryQuery = useQuery({
    queryKey: ['inventory-brief'] as const,
    enabled: formOpen && Boolean(supplierId),
    staleTime: 60000,
    queryFn: async (): Promise<InventoryBriefItem[]> => {
      const res = await authFetch('/api/inventory')
      if (!res.ok) return []
      const json = await res.json() as unknown
      const list = Array.isArray(json) ? json : ((json as { items?: unknown[] } | null)?.items ?? [])
      return (Array.isArray(list) ? list : []).map((item: Record<string, unknown>) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? 'Neznan artikel'),
        unit: String(item.unit ?? 'kos'),
      }))
    },
  })
  const inventoryItems = Array.isArray(inventoryQuery.data) ? inventoryQuery.data : []

  const items = Array.isArray(query.data?.items) ? query.data.items : []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.catalog(supplierId) })
  }

  // --- POST upsert (create + update + toggle isActive) ---
  const upsertMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await authFetch(`/api/suppliers/${encodeURIComponent(supplierId)}/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      // odgovor je lahko prazen/pokvarjen — ne sme povzročiti neulovljene napake
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json?.error || `catalog upsert ${res.status}`)
      return json
    },
    onSuccess: () => {
      invalidate()
      closeForm()
      toast.success(t('suppliers.catalog.saved'))
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error && err.message ? err.message : t('suppliers.catalog.saveError'))
    },
  })

  // --- DELETE z ?catalogItemId= ---
  const deleteMutation = useMutation({
    mutationFn: async (catalogItemId: string) => {
      const res = await authFetch(`/api/suppliers/${encodeURIComponent(supplierId)}/catalog?catalogItemId=${encodeURIComponent(catalogItemId)}`, {
        method: 'DELETE',
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json?.error || `catalog delete ${res.status}`)
      return json
    },
    onSuccess: () => {
      invalidate()
      toast.success(t('suppliers.catalog.deleted'))
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error && err.message ? err.message : t('suppliers.catalog.saveError'))
    },
  })

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function openAddForm() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEditForm(item: SupplierCatalogItem) {
    setEditing(item)
    setForm({
      inventoryItemId: item.inventoryItem?.id ?? '',
      packQty: isValidPack(item.packQty) ? Number(item.packQty) : 1,
      packUnit: typeof item.packUnit === 'string' && item.packUnit.trim() ? item.packUnit : 'paket',
      pricePerPack: toNum(item.pricePerPack),
      vatRate: toNum(item.vatRate),
      minOrderPacks: Number.isFinite(Number(item.minOrderPacks)) && Number(item.minOrderPacks) > 0 ? Number(item.minOrderPacks) : 1,
      supplierSku: typeof item.supplierSku === 'string' ? item.supplierSku : '',
    })
    setFormOpen(true)
  }

  function handleSubmit() {
    if (!form.inventoryItemId) {
      toast.error(t('suppliers.catalog.inventoryItem'))
      return
    }
    if (!isValidPack(form.packQty)) {
      toast.error(t('suppliers.catalog.invalidPackQty'))
      return
    }
    upsertMutation.mutate({
      inventoryItemId: form.inventoryItemId,
      packQty: Number(form.packQty),
      packUnit: form.packUnit.trim() || 'paket',
      pricePerPack: Math.max(0, Number(form.pricePerPack) || 0),
      // vatRate opcijsko: 0 / prazno → null (ni poslan)
      ...(form.vatRate > 0 ? { vatRate: Number(form.vatRate) } : {}),
      minOrderPacks: Math.max(1, Math.round(Number(form.minOrderPacks) || 1)),
      ...(form.supplierSku.trim() ? { supplierSku: form.supplierSku.trim() } : {}),
      note: editing?.note ?? '',
      isActive: editing ? editing.isActive !== false : true,
    })
  }

  function handleToggleActive(item: SupplierCatalogItem) {
    const invId = item.inventoryItem?.id
    if (!invId || !isValidPack(item.packQty)) return
    upsertMutation.mutate({
      inventoryItemId: invId,
      packQty: Number(item.packQty),
      packUnit: typeof item.packUnit === 'string' && item.packUnit.trim() ? item.packUnit : 'paket',
      pricePerPack: Math.max(0, toNum(item.pricePerPack)),
      ...(toNum(item.vatRate) > 0 ? { vatRate: toNum(item.vatRate) } : {}),
      minOrderPacks: Number.isFinite(Number(item.minOrderPacks)) && Number(item.minOrderPacks) > 0 ? Number(item.minOrderPacks) : 1,
      ...(typeof item.supplierSku === 'string' && item.supplierSku ? { supplierSku: item.supplierSku } : {}),
      note: item.note ?? '',
      isActive: item.isActive === false, // toggle
    })
  }

  function handleDelete(item: SupplierCatalogItem) {
    const name = item.inventoryItem?.name ?? item.supplierSku ?? item.id
    if (!window.confirm(t('suppliers.catalog.deleteConfirm', { name }))) return
    deleteMutation.mutate(item.id)
  }

  const isPending = upsertMutation.isPending || deleteMutation.isPending

  return (
    <section className={cn('space-y-2', className)} aria-label={t('suppliers.catalog.title')}>
      {/* naslov + gumb za dodajanje */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Package className="h-3.5 w-3.5" aria-hidden="true" />
          {t('suppliers.catalog.title')}
        </h4>
        {!formOpen && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs pointer-coarse:h-11 pointer-coarse:px-4"
            onClick={openAddForm}
          >
            <Plus className="mr-1 h-3 w-3" /> {t('suppliers.catalog.addItem')}
          </Button>
        )}
      </div>

      {/* obrazec (dodaj / uredi) — zložljiv */}
      {formOpen && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-semibold">
            {editing ? t('suppliers.catalog.editItem') : t('suppliers.catalog.addItem')}
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {/* artikel zaloge (pri urejanju zaklenjen — upsert je vezan na par (supplier, item)) */}
            <div className="md:col-span-2">
              <label htmlFor="catalog-inv-item" className="text-[10px] text-muted-foreground">
                {t('suppliers.catalog.inventoryItem')} *
              </label>
              <Select
                value={form.inventoryItemId || undefined}
                onValueChange={v => setForm(f => ({ ...f, inventoryItemId: v }))}
                disabled={!!editing}
              >
                <SelectTrigger id="catalog-inv-item" className="h-9 text-xs">
                  <SelectValue placeholder={t('suppliers.catalog.inventoryItem')} />
                </SelectTrigger>
                <SelectContent>
                  {/* fallback: pri urejanju je artikel zaklenjen — pokazi ime tudi, če
                      seznam inventory items še ni naložen ali artikel manjka v njem */}
                  {editing && form.inventoryItemId && !inventoryItems.some(inv => inv.id === form.inventoryItemId) && (
                    <SelectItem value={form.inventoryItemId}>
                      {editing.inventoryItem?.name ?? form.inventoryItemId}
                    </SelectItem>
                  )}
                  {inventoryItems.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name} ({inv.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="catalog-pack-qty" className="text-[10px] text-muted-foreground">
                {t('suppliers.catalog.packQty')} *
              </label>
              <DecimalInput
                id="catalog-pack-qty"
                value={form.packQty}
                onValueChange={n => setForm(f => ({ ...f, packQty: n }))}
                className="h-9 text-xs"
                aria-label={t('suppliers.catalog.packQty')}
              />
            </div>
            <div>
              <label htmlFor="catalog-pack-unit" className="text-[10px] text-muted-foreground">
                {t('suppliers.catalog.packUnit')}
              </label>
              <Input
                id="catalog-pack-unit"
                value={form.packUnit}
                onChange={e => setForm(f => ({ ...f, packUnit: e.target.value }))}
                placeholder="paket"
                className="h-9 text-xs"
                aria-label={t('suppliers.catalog.packUnit')}
              />
            </div>
            <div>
              <label htmlFor="catalog-price" className="text-[10px] text-muted-foreground">
                {t('suppliers.catalog.pricePerPack')} *
              </label>
              <DecimalInput
                id="catalog-price"
                value={form.pricePerPack}
                onValueChange={n => setForm(f => ({ ...f, pricePerPack: n }))}
                className="h-9 text-xs"
                aria-label={t('suppliers.catalog.pricePerPack')}
              />
            </div>
            <div>
              <label htmlFor="catalog-vat" className="text-[10px] text-muted-foreground">
                {t('suppliers.catalog.vatRate')}
              </label>
              <DecimalInput
                id="catalog-vat"
                value={form.vatRate}
                onValueChange={n => setForm(f => ({ ...f, vatRate: n }))}
                className="h-9 text-xs"
                aria-label={t('suppliers.catalog.vatRate')}
              />
            </div>
            <div>
              <label htmlFor="catalog-min-order" className="text-[10px] text-muted-foreground">
                {t('suppliers.catalog.minOrderPacks')}
              </label>
              <DecimalInput
                id="catalog-min-order"
                value={form.minOrderPacks}
                onValueChange={n => setForm(f => ({ ...f, minOrderPacks: n }))}
                className="h-9 text-xs"
                aria-label={t('suppliers.catalog.minOrderPacks')}
              />
            </div>
            <div>
              <label htmlFor="catalog-sku" className="text-[10px] text-muted-foreground">
                {t('suppliers.catalog.supplierSku')}
              </label>
              <Input
                id="catalog-sku"
                value={form.supplierSku}
                onChange={e => setForm(f => ({ ...f, supplierSku: e.target.value }))}
                className="h-9 text-xs"
                aria-label={t('suppliers.catalog.supplierSku')}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs pointer-coarse:h-11 pointer-coarse:px-4"
              onClick={closeForm}
              disabled={isPending}
            >
              {t('suppliers.catalog.cancel')}
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs pointer-coarse:h-11 pointer-coarse:px-4"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {upsertMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {t('suppliers.catalog.save')}
            </Button>
          </div>
        </div>
      )}

      {/* nalaganje — skelet (pariteta SupplierPriceHistory) */}
      {query.isLoading && (
        <div className="space-y-1.5" role="status" aria-busy="true">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
        </div>
      )}

      {/* napaka + retry */}
      {query.isError && (
        <div>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">{t('suppliers.catalog.error')}</AlertTitle>
          </Alert>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => query.refetch()}>
            <RefreshCw className="mr-1 h-3 w-3" /> {t('suppliers.catalog.retry')}
          </Button>
        </div>
      )}

      {/* prazno stanje (kanon: ne izmišljujemo podatkov) */}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <Package className="h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
          {t('suppliers.catalog.empty')}
        </div>
      )}

      {/* tabela (dolgi seznami: navpični scroll; mobilno: horizontalni) */}
      {!query.isLoading && !query.isError && items.length > 0 && (
        <div className="max-h-96 overflow-auto custom-scrollbar">
          <table className="w-full min-w-[640px] text-xs" aria-label={t('suppliers.catalog.title')}>
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.catalog.item')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.catalog.sku')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.catalog.packUnit')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.catalog.pricePerPack')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.catalog.basePrice')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.catalog.minOrder')}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t('suppliers.catalog.status')}</th>
                <th scope="col" className="py-1.5 font-medium">{t('suppliers.catalog.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const baseUnit = item.inventoryItem?.unit ?? ''
                const packQty = item.packQty
                const packed = isValidPack(packQty)
                // baseUnitPrice: iz API-ja; če manjka → defenzivni izračun na klientu
                const basePrice = item.baseUnitPrice != null
                  ? toNum(item.baseUnitPrice)
                  : baseUnitPriceFromPack(item.pricePerPack, packQty)
                const active = item.isActive !== false
                const name = item.inventoryItem?.name ?? '—'
                const packaging = packed
                  ? t('suppliers.catalog.packaging', {
                      packUnit: item.packUnit ?? 'paket',
                      packQty: fmtPackQty(packQty),
                      unit: baseUnit,
                    })
                  : '—'
                return (
                  <tr key={item.id} className={cn('border-b last:border-0', !active && 'opacity-60')}>
                    <td className="max-w-[180px] truncate py-2 pr-3 font-medium" title={name}>{name}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">{item.supplierSku || '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{packaging}</td>
                    <td className="py-2 pr-3 whitespace-nowrap font-semibold">
                      {item.pricePerPack == null ? '—' : formatEUR(toNum(item.pricePerPack))}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {basePrice === null
                        ? '—'
                        : <span>{formatEUR(basePrice)} <span className="font-normal text-muted-foreground">/ {baseUnit}</span></span>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{fmtPackQty(item.minOrderPacks ?? 1)}</td>
                    <td className="py-2 pr-3">
                      {active ? (
                        <Badge variant="outline" className="whitespace-nowrap border-emerald-300 bg-emerald-100 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {t('suppliers.catalog.active')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="whitespace-nowrap text-[10px]">
                          {t('suppliers.catalog.inactive')}
                        </Badge>
                      )}
                    </td>
                    <td className="py-1">
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('suppliers.catalog.edit')}
                          className="h-7 w-7 pointer-coarse:h-11 pointer-coarse:w-11"
                          onClick={() => openEditForm(item)}
                          disabled={isPending}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('suppliers.catalog.toggleActive')}
                          className="h-7 w-7 pointer-coarse:h-11 pointer-coarse:w-11"
                          onClick={() => handleToggleActive(item)}
                          disabled={isPending}
                        >
                          <Power className={cn('h-3 w-3', active ? 'text-emerald-600' : 'text-zinc-400')} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('suppliers.catalog.delete')}
                          className="h-7 w-7 pointer-coarse:h-11 pointer-coarse:w-11"
                          onClick={() => handleDelete(item)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
})

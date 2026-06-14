'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Alergeni matrika (EU 1169/2011 standard)
// Celovit pregled alergenov po menijih
// Obvezno za EU restavracije — EU Reg. 1169/2011
// ═══════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { ShieldAlert } from 'lucide-react'
import { useState, useMemo, memo } from 'react'
import { toast } from 'sonner'

import { EU_ALLERGENS, parseAllergens } from './allergen-matrix/constants'
import type { MenuItem } from './allergen-matrix/constants'

// ─── Lazy-loadani pod-komponenti (ssr: false) ──────────────
const StatsCards = dynamic(
  () => import('./allergen-matrix/StatsCards').then(m => ({ default: m.StatsCards })),
  { ssr: false },
)
const AllergenFrequency = dynamic(
  () => import('./allergen-matrix/AllergenFrequency').then(m => ({ default: m.AllergenFrequency })),
  { ssr: false },
)
const AllergenFilters = dynamic(
  () => import('./allergen-matrix/AllergenFilters').then(m => ({ default: m.AllergenFilters })),
  { ssr: false },
)
const AllergenTable = dynamic(
  () => import('./allergen-matrix/AllergenTable').then(m => ({ default: m.AllergenTable })),
  { ssr: false },
)
const EuDisclaimer = dynamic(
  () => import('./allergen-matrix/EuDisclaimer').then(m => ({ default: m.EuDisclaimer })),
  { ssr: false },
)
const EditAllergenDialog = dynamic(
  () => import('./allergen-matrix/EditAllergenDialog').then(m => ({ default: m.EditAllergenDialog })),
  { ssr: false },
)

export const AllergenMatrix = memo(function AllergenMatrix() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [editAllergens, setEditAllergens] = useState<string[]>([])
  const [showOnlyWithAllergens, setShowOnlyWithAllergens] = useState(false)
  const [sortField, setSortField] = useState<'name' | 'allergens'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ─── Nalaganje menijev ────────────────────────────────────
  const { data: menuItems, isLoading } = useQuery<MenuItem[]>({
    queryKey: queryKeys.menuItems.allergens,
    queryFn: async () => {
      const res = await authFetch('/api/categories')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const categories = await res.json()
      // Pridobi vse artikle iz kategorij
      const allItems: MenuItem[] = []
      for (const cat of categories) {
        if (cat.menuItems) {
          for (const item of cat.menuItems) {
            allItems.push({ ...item, category: { name: cat.name } })
          }
        }
      }
      return allItems
    },
  })

  // ─── Mutacija: posodobi alergene ──────────────────────────
  const updateAllergens = useMutation({
    mutationFn: async ({ itemId, allergens }: { itemId: string; allergens: string[] }) => {
      // FIX HIGH: Pošlji na pravilen endpoint — /api/menu-items/[id]
      // FIX HIGH: Shrani alergene kot comma-separated CODES ("1,3,7"), ne JSON array IDs
      const allergensString = allergens
        .map(id => EU_ALLERGENS.find(a => a.id === id)?.code)
        .filter((code): code is string => !!code)
        .join(',')
      const res = await authFetch(`/api/menu-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergens: allergensString }),
      })
      if (!res.ok) throw new Error('Napaka pri posodabljanju alergenov')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Alergeni posodobljeni')
      setEditItem(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.allergens })
    },
    onError: () => {
      toast.error('Napaka pri posodabljanju alergenov')
    },
  })

  // ─── Filtriranje in razvrščanje ───────────────────────────
  const filteredItems = useMemo(() => {
    let items = menuItems || []
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(q))
    }
    if (categoryFilter !== 'all') {
      items = items.filter(i => i.category?.name === categoryFilter)
    }
    if (showOnlyWithAllergens) {
      items = items.filter(i => parseAllergens(i.allergens).length > 0)
    }
    items.sort((a, b) => {
      if (sortField === 'name') {
        return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      }
      const aLen = parseAllergens(a.allergens).length
      const bLen = parseAllergens(b.allergens).length
      return sortDir === 'asc' ? aLen - bLen : bLen - aLen
    })
    return items
  }, [menuItems, searchQuery, categoryFilter, showOnlyWithAllergens, sortField, sortDir])

  // ─── Kategorije za filter ─────────────────────────────────
  const categories = useMemo(() => {
    const cats = new Set<string>()
    ;(menuItems || []).forEach(i => { if (i.category?.name) cats.add(i.category.name) })
    return Array.from(cats).sort()
  }, [menuItems])

  // ─── Statistika ───────────────────────────────────────────
  const totalItems = menuItems?.length || 0
  const itemsWithAllergens = (menuItems || []).filter(i => parseAllergens(i.allergens).length > 0).length
  const itemsWithoutAllergens = totalItems - itemsWithAllergens

  const allergenCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(menuItems || []).forEach(item => {
      for (const a of parseAllergens(item.allergens)) {
        counts[a] = (counts[a] || 0) + 1
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([id, count]) => {
        const found = EU_ALLERGENS.find(a => a.id === id)
        return {
          id,
          code: found?.code ?? '',
          label: found?.label ?? id,
          labelEn: found?.labelEn ?? '',
          icon: found?.icon ?? '?',
          count,
        }
      })
  }, [menuItems])

  // ─── Handlers ─────────────────────────────────────────────
  const handleSortDirToggle = () => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
  const handleEditItem = (item: MenuItem) => {
    setEditItem(item)
    setEditAllergens(parseAllergens(item.allergens))
  }
  const handleDialogOpenChange = (open: boolean) => { if (!open) setEditItem(null) }
  const handleSave = () => {
    if (editItem) updateAllergens.mutate({ itemId: editItem.id, allergens: editAllergens })
  }

  // ─── Nalaganje skeleton ───────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((__, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          Matrika alergenov
        </h2>
        <p className="text-sm text-muted-foreground">
          EU Uredba 1169/2011 — Obvezno označevanje 14 alergenov v živilih
        </p>
      </div>

      <StatsCards
        totalItems={totalItems}
        itemsWithAllergens={itemsWithAllergens}
        itemsWithoutAllergens={itemsWithoutAllergens}
        topAllergen={allergenCounts[0]}
      />

      <AllergenFrequency allergenCounts={allergenCounts} totalItems={totalItems} />

      <AllergenFilters
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categories={categories}
        showOnlyWithAllergens={showOnlyWithAllergens}
        onShowOnlyWithAllergensChange={setShowOnlyWithAllergens}
      />

      <AllergenTable
        filteredItems={filteredItems}
        sortField={sortField}
        sortDir={sortDir}
        onSortFieldChange={setSortField}
        onSortDirToggle={handleSortDirToggle}
        onEditItem={handleEditItem}
      />

      <EuDisclaimer />

      <EditAllergenDialog
        open={!!editItem}
        editItem={editItem}
        editAllergens={editAllergens}
        onOpenChange={handleDialogOpenChange}
        onEditAllergensChange={setEditAllergens}
        onSave={handleSave}
        isPending={updateAllergens.isPending}
      />
    </div>
  )
})

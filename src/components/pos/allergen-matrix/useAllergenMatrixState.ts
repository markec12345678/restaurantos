'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { toast } from 'sonner'
import { EU_ALLERGENS, parseAllergens } from './constants'
import type { MenuItem } from './constants'

export function useAllergenMatrixState() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [editAllergens, setEditAllergens] = useState<string[]>([])
  const [showOnlyWithAllergens, setShowOnlyWithAllergens] = useState(false)
  const [sortField, setSortField] = useState<'name' | 'allergens'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data: menuItems, isLoading } = useQuery<MenuItem[]>({
    queryKey: queryKeys.menuItems.allergens,
    queryFn: async () => {
      const res = await authFetch('/api/categories')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const json = await res.json()
      // FIX: /api/categories vrača {categories, total, ...} — podpremo tudi legacy array
      const categories: Array<{ menuItems?: MenuItem[]; name?: string }> = Array.isArray(json)
        ? json
        : (json?.categories ?? [])
      const allItems: MenuItem[] = []
      for (const cat of categories) {
        if (cat.menuItems) {
          for (const item of cat.menuItems) {
            allItems.push({ ...item, category: { name: cat.name ?? '' } })
          }
        }
      }
      return allItems
    },
  })

  const updateAllergens = useMutation({
    mutationFn: async ({ itemId, allergens }: { itemId: string; allergens: string[] }) => {
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
    onError: () => { toast.error('Napaka pri posodabljanju alergenov') },
  })

  const filteredItems = useMemo(() => {
    let items = menuItems || []
    if (searchQuery) { const q = searchQuery.toLowerCase(); items = items.filter(i => i.name.toLowerCase().includes(q)) }
    if (categoryFilter !== 'all') items = items.filter(i => i.category?.name === categoryFilter)
    if (showOnlyWithAllergens) items = items.filter(i => parseAllergens(i.allergens).length > 0)
    items.sort((a, b) => {
      if (sortField === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      const aLen = parseAllergens(a.allergens).length
      const bLen = parseAllergens(b.allergens).length
      return sortDir === 'asc' ? aLen - bLen : bLen - aLen
    })
    return items
  }, [menuItems, searchQuery, categoryFilter, showOnlyWithAllergens, sortField, sortDir])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    ;(menuItems || []).forEach(i => { if (i.category?.name) cats.add(i.category.name) })
    return Array.from(cats).sort()
  }, [menuItems])

  const totalItems = menuItems?.length || 0
  const itemsWithAllergens = (menuItems || []).filter(i => parseAllergens(i.allergens).length > 0).length
  const itemsWithoutAllergens = totalItems - itemsWithAllergens

  const allergenCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(menuItems || []).forEach(item => {
      for (const a of parseAllergens(item.allergens)) { counts[a] = (counts[a] || 0) + 1 }
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([id, count]) => {
      const found = EU_ALLERGENS.find(a => a.id === id)
      return { id, code: found?.code ?? '', label: found?.label ?? id, labelEn: found?.labelEn ?? '', icon: found?.icon ?? '?', count }
    })
  }, [menuItems])

  const handleSortDirToggle = useCallback(() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc'), [])
  const handleEditItem = useCallback((item: MenuItem) => { setEditItem(item); setEditAllergens(parseAllergens(item.allergens)) }, [])
  const handleDialogOpenChange = useCallback((open: boolean) => { if (!open) setEditItem(null) }, [])
  const handleSave = useCallback(() => { if (editItem) updateAllergens.mutate({ itemId: editItem.id, allergens: editAllergens }) }, [editItem, editAllergens, updateAllergens])

  return {
    searchQuery, setSearchQuery, categoryFilter, setCategoryFilter,
    showOnlyWithAllergens, setShowOnlyWithAllergens,
    sortField, setSortField, sortDir, handleSortDirToggle,
    editItem, editAllergens, setEditAllergens, handleDialogOpenChange, handleSave,
    isLoading, filteredItems, categories, totalItems, itemsWithAllergens, itemsWithoutAllergens,
    allergenCounts, handleEditItem, isPending: updateAllergens.isPending,
  }
}

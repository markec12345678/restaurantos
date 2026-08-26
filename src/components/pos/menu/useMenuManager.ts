'use client'
// ============================================
// HOOK: Stanje in logika za upravitelja jedilnika
// Izvleče poslovno logiko iz glavne komponente
// ============================================

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { ItemFormState, CategoryFormState, MenuFormState } from './constants'
import { useMenuMutations } from './useMenuMutations'

export function useMenuManager() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterMenu, setFilterMenu] = useState('all')
  const [activeTab, setActiveTab] = useState('items')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormState>({ name: '', description: '', price: '', categoryId: '', isAvailable: true, image: '', modifierGroupIds: [] })
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [catForm, setCatForm] = useState<CategoryFormState>({ name: '', icon: '🍽️', color: '#f59e0b', menuId: '' })
  const [menuDialogOpen, setMenuDialogOpen] = useState(false)
  const [menuForm, setMenuForm] = useState<MenuFormState>({ name: '', icon: '📋', color: '#f59e0b' })

  // ============================================
  // QUERIES
  // ============================================
  const { data: menus } = useQuery({
    queryKey: queryKeys.menus.all,
    queryFn: async () => {
      const res = await authFetch('/api/menus')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.menus ?? [])
    },
  })
  const { data: categories } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      const res = await authFetch('/api/categories')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.categories ?? [])
    },
  })
  const { data: modifierGroups } = useQuery({
    queryKey: queryKeys.modifierGroups.all,
    queryFn: async () => {
      const res = await authFetch('/api/modifier-groups')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.modifierGroups ?? [])
    },
  })
  const { data: menuItems, isLoading } = useQuery({
    queryKey: queryKeys.menuItems.all,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.menuItems ?? json.items ?? [])
    },
  })

  // FIX PERF: useMemo za filtriranje -- prej se je filtriralo ob vsakem renderu
  const filteredItems = useMemo(() => (Array.isArray(menuItems) ? menuItems : []).filter((item: { name: string; categoryId: string; category?: { menu?: { id: string } } }) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCat = filterCategory === 'all' || item.categoryId === filterCategory
    const matchesMenu = filterMenu === 'all' || item.category?.menu?.id === filterMenu
    return matchesSearch && matchesCat && matchesMenu
  }), [menuItems, search, filterCategory, filterMenu])

  // ============================================
  // MUTATIONS (podedovane iz pod-hooka)
  // ============================================
  const {
    createMenuMutation,
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
    toggleAvailabilityMutation,
    createCatMutation,
  } = useMenuMutations({
    onCloseItemDialog: () => setDialogOpen(false),
    onClearEditingItem: () => setEditingItem(null),
    onCloseCatDialog: () => setCatDialogOpen(false),
    onCloseMenuDialog: () => setMenuDialogOpen(false),
  })

  // ============================================
  // HANDLERJI
  // ============================================
  const openCreateItem = useCallback(() => {
    setEditingItem(null)
    setItemForm({ name: '', description: '', price: '', categoryId: categories?.[0]?.id || '', isAvailable: true, image: '', modifierGroupIds: [] })
    setDialogOpen(true)
  }, [categories])

  const openEditItem = useCallback((item: Record<string, unknown>) => {
    setEditingItem(item)
    const existingModGroups = (item.modifierGroups as { modifierGroup: { id: string } }[])?.map(mg => mg.modifierGroup.id) || []
    setItemForm({
      name: String(item.name),
      description: String(item.description || ''),
      price: String(item.price),
      categoryId: String(item.categoryId),
      isAvailable: Boolean(item.isAvailable),
      image: String(item.image || ''),
      modifierGroupIds: existingModGroups,
    })
    setDialogOpen(true)
  }, [])

  const handleItemSubmit = useCallback(() => {
    const payload = { ...itemForm, price: parseFloat(itemForm.price) }
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id as string, ...payload })
    } else {
      createItemMutation.mutate(payload)
    }
  }, [itemForm, editingItem, updateItemMutation, createItemMutation])

  const openCreateCategory = useCallback(() => {
    setCatForm({ name: '', icon: '🍽️', color: '#f59e0b', menuId: menus?.[0]?.id || '' })
    setCatDialogOpen(true)
  }, [menus])

  const openCreateMenu = useCallback(() => {
    setMenuForm({ name: '', icon: '📋', color: '#f59e0b' })
    setMenuDialogOpen(true)
  }, [])

  return {
    // Stanja
    viewMode, setViewMode, search, setSearch,
    filterCategory, setFilterCategory, filterMenu, setFilterMenu,
    activeTab, setActiveTab,
    dialogOpen, setDialogOpen, editingItem, itemForm, setItemForm,
    catDialogOpen, setCatDialogOpen, catForm, setCatForm,
    menuDialogOpen, setMenuDialogOpen, menuForm, setMenuForm,
    // Poizvedbe
    menus, categories, modifierGroups, menuItems, isLoading, filteredItems,
    // Mutacije
    createMenuMutation, deleteItemMutation, toggleAvailabilityMutation, createCatMutation,
    // Handlerji
    openCreateItem, openEditItem, handleItemSubmit,
    openCreateCategory, openCreateMenu,
  }
}

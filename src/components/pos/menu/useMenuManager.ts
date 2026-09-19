'use client'
// ============================================
// HOOK: Stanje in logika za upravitelja jedilnika
// Izvleče poslovno logiko iz glavne komponente
// ============================================

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { ItemFormState, CategoryFormState, MenuFormState, ModifierGroupFormState } from './constants'
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
  // RUNDA 66: urejanje kategorije — null = ustvarjanje, objekt = urejanje
  const [editingCategory, setEditingCategory] = useState<Record<string, unknown> | null>(null)
  const [menuDialogOpen, setMenuDialogOpen] = useState(false)
  const [menuForm, setMenuForm] = useState<MenuFormState>({ name: '', icon: '📋', color: '#f59e0b', isActive: true })
  // RUNDA 67: urejanje menija — null = ustvarjanje, objekt = urejanje
  const [editingMenu, setEditingMenu] = useState<Record<string, unknown> | null>(null)
  // RUNDA 68: skupine dodatkov — dialog + forma + urejanje
  const [modGroupDialogOpen, setModGroupDialogOpen] = useState(false)
  const [modGroupForm, setModGroupForm] = useState<ModifierGroupFormState>({
    name: '', required: false, minSelect: '0', maxSelect: '', modifiers: [{ name: '', price: '' }],
  })
  const [editingModifierGroup, setEditingModifierGroup] = useState<Record<string, unknown> | null>(null)

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
    updateMenuMutation,
    deleteMenuMutation,
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
    toggleAvailabilityMutation,
    createCatMutation,
    updateCatMutation,
    deleteCatMutation,
    createModGroupMutation,
    updateModGroupMutation,
    deleteModGroupMutation,
  } = useMenuMutations({
    onCloseItemDialog: () => setDialogOpen(false),
    onClearEditingItem: () => setEditingItem(null),
    onCloseCatDialog: () => setCatDialogOpen(false),
    onCloseMenuDialog: () => setMenuDialogOpen(false),
    onCloseModGroupDialog: () => setModGroupDialogOpen(false),
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
    setEditingCategory(null)
    setCatForm({ name: '', icon: '🍽️', color: '#f59e0b', menuId: menus?.[0]?.id || '' })
    setCatDialogOpen(true)
  }, [menus])

  // RUNDA 66: odpri dialog v urejevalnem načinu z izpolnjeno formo
  const openEditCategory = useCallback((cat: Record<string, unknown>) => {
    setEditingCategory(cat)
    setCatForm({
      name: String(cat.name ?? ''),
      icon: String(cat.icon ?? '🍽️'),
      color: String(cat.color ?? '#f59e0b'),
      menuId: String(cat.menuId ?? (cat.menu as { id?: string } | undefined)?.id ?? ''),
    })
    setCatDialogOpen(true)
  }, [])

  // RUNDA 66: skupni submit — ustvari ali posodobi glede na editingCategory
  const handleCatSubmit = useCallback(() => {
    if (editingCategory) {
      updateCatMutation.mutate({ id: editingCategory.id as string, ...catForm })
    } else {
      createCatMutation.mutate(catForm as unknown as Record<string, unknown>)
    }
  }, [catForm, editingCategory, updateCatMutation, createCatMutation])

  const openCreateMenu = useCallback(() => {
    setEditingMenu(null)
    setMenuForm({ name: '', icon: '📋', color: '#f59e0b', isActive: true })
    setMenuDialogOpen(true)
  }, [])

  // RUNDA 67: odpri dialog v urejevalnem načinu z izpolnjeno formo
  const openEditMenu = useCallback((menu: Record<string, unknown>) => {
    setEditingMenu(menu)
    setMenuForm({
      name: String(menu.name ?? ''),
      icon: String(menu.icon ?? '📋'),
      color: String(menu.color ?? '#f59e0b'),
      isActive: menu.isActive !== false,
    })
    setMenuDialogOpen(true)
  }, [])

  // RUNDA 67: skupni submit — ustvari ali posodobi glede na editingMenu
  const handleMenuSubmit = useCallback(() => {
    if (editingMenu) {
      updateMenuMutation.mutate({ id: editingMenu.id as string, ...menuForm })
    } else {
      createMenuMutation.mutate(menuForm as unknown as Record<string, unknown>)
    }
  }, [menuForm, editingMenu, updateMenuMutation, createMenuMutation])

  // RUNDA 68: skupine dodatkov — ustvarjanje/urejanje
  const openCreateModifierGroup = useCallback(() => {
    setEditingModifierGroup(null)
    setModGroupForm({ name: '', required: false, minSelect: '0', maxSelect: '', modifiers: [{ name: '', price: '' }] })
    setModGroupDialogOpen(true)
  }, [])

  const openEditModifierGroup = useCallback((group: Record<string, unknown>) => {
    setEditingModifierGroup(group)
    const mods = Array.isArray(group.modifiers) ? group.modifiers : []
    setModGroupForm({
      name: String(group.name ?? ''),
      required: Boolean(group.required),
      minSelect: String(group.minSelect ?? 0),
      maxSelect: group.maxSelect === null || group.maxSelect === undefined ? '' : String(group.maxSelect),
      modifiers: mods.length > 0
        ? mods.map((m) => ({ name: String((m as { name?: unknown }).name ?? ''), price: String((m as { price?: unknown }).price ?? '') }))
        : [{ name: '', price: '' }],
    })
    setModGroupDialogOpen(true)
  }, [])

  const handleModGroupSubmit = useCallback(() => {
    // maxSelect: prazen niz → null (neomejeno); sicer število
    const maxNum = modGroupForm.maxSelect.trim() === '' ? null : parseInt(modGroupForm.maxSelect, 10)
    const payload = {
      name: modGroupForm.name.trim(),
      required: modGroupForm.required,
      minSelect: parseInt(modGroupForm.minSelect, 10) || 0,
      maxSelect: maxNum !== null && Number.isNaN(maxNum) ? null : maxNum,
      modifiers: modGroupForm.modifiers
        .filter((m) => m.name.trim() !== '')
        .map((m, i) => ({ name: m.name.trim(), price: parseFloat(m.price) || 0, sortOrder: i })),
    }
    if (editingModifierGroup) {
      updateModGroupMutation.mutate({ id: editingModifierGroup.id as string, ...payload })
    } else {
      createModGroupMutation.mutate(payload)
    }
  }, [modGroupForm, editingModifierGroup, updateModGroupMutation, createModGroupMutation])

  return {
    // Stanja
    viewMode, setViewMode, search, setSearch,
    filterCategory, setFilterCategory, filterMenu, setFilterMenu,
    activeTab, setActiveTab,
    dialogOpen, setDialogOpen, editingItem, itemForm, setItemForm,
    catDialogOpen, setCatDialogOpen, catForm, setCatForm, editingCategory,
    menuDialogOpen, setMenuDialogOpen, menuForm, setMenuForm, editingMenu,
    modGroupDialogOpen, setModGroupDialogOpen, modGroupForm, setModGroupForm, editingModifierGroup,
    // Poizvedbe
    menus, categories, modifierGroups, menuItems, isLoading, filteredItems,
    // Mutacije
    deleteItemMutation, toggleAvailabilityMutation,
    deleteCatMutation, deleteMenuMutation, deleteModGroupMutation,
    // Handlerji
    openCreateItem, openEditItem, handleItemSubmit,
    openCreateCategory, openEditCategory, handleCatSubmit,
    openCreateMenu, openEditMenu, handleMenuSubmit,
    openCreateModifierGroup, openEditModifierGroup, handleModGroupSubmit,
  }
}

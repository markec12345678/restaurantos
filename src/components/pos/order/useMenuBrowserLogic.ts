'use client'

import { useMemo } from 'react'
import type { MenuItemType, MenuType, SuperGroupType } from './types'

// ============================================
// LOGIKA za MenuBrowser — izračuni in filtri
// ============================================

interface UseMenuBrowserLogicParams {
  menus: MenuType[] | undefined
  menuItems: MenuItemType[] | undefined
  activeMenuId: string | null
  activeCategory: string
  activeSuperGroup: string
  superGroups: SuperGroupType[]
  itemSearch: string
}

export function useMenuBrowserLogic({
  menus,
  menuItems,
  activeMenuId,
  activeCategory,
  activeSuperGroup,
  superGroups,
  itemSearch,
}: UseMenuBrowserLogicParams) {
  const resolvedMenuId = useMemo(() => {
    if (activeMenuId) return activeMenuId
    if (menus && menus.length > 0) return menus[0].id
    return null
  }, [activeMenuId, menus])

  const activeMenu = menus?.find((m: MenuType) => m.id === resolvedMenuId)
  const categoriesForMenu = activeMenu?.categories || []

  const filteredMenuItems = useMemo(() => {
    return menuItems?.filter(
      (item: MenuItemType) => {
        const matchesMenu = !resolvedMenuId || item.category?.menu?.id === resolvedMenuId
        const matchesCategory = activeCategory === 'all' || item.categoryId === activeCategory
        const matchesSuperGroup = activeSuperGroup === 'all' ||
          superGroups.some(sg => sg.id === activeSuperGroup && sg.categoryIds.includes(item.categoryId))
        const matchesSearch = !itemSearch || item.name.toLowerCase().includes(itemSearch.toLowerCase())
        return matchesMenu && matchesCategory && matchesSuperGroup && matchesSearch && item.isAvailable
      }
    ) || []
  }, [menuItems, resolvedMenuId, activeCategory, activeSuperGroup, superGroups, itemSearch])

  return { resolvedMenuId, activeMenu, categoriesForMenu, filteredMenuItems }
}

// SUPER-GROUPS for drinks menu (Toast POS style sub-groups)
export function buildSuperGroups(categoriesForMenu: Array<{ id: string; name: string }>): SuperGroupType[] {
  const catNames = categoriesForMenu.map(c => c.name)
  if (!catNames.includes('Penine in Šampanjci')) return []

  return [
    { id: 'vina', name: 'Vina', icon: '🍷', color: '#7c2d12', categoryIds: categoriesForMenu.filter(c => ['Penine in Šampanjci', 'Bela Vina', 'Rosé Vino', 'Rdeča Vina', 'Tuja Vina', 'Likersko Vino'].includes(c.name)).map(c => c.id) },
    { id: 'piva', name: 'Piva', icon: '🍺', color: '#d97706', categoryIds: categoriesForMenu.filter(c => ['Točeno Pivo', 'Pivo', 'Craft Piva', 'Brezalkoholno Pivo'].includes(c.name)).map(c => c.id) },
    { id: 'zganepijace', name: 'Žgane pijače', icon: '🥃', color: '#6b21a8', categoryIds: categoriesForMenu.filter(c => ['Viski', 'Gin', 'Likerji', 'Grenčice', 'Destilati, Konjak in Rum'].includes(c.name)).map(c => c.id) },
    { id: 'napitki', name: 'Napitki', icon: '☕', color: '#92400e', categoryIds: categoriesForMenu.filter(c => ['Topli Napitki', 'Mešane Pijače'].includes(c.name)).map(c => c.id) },
    { id: 'brezalkoholne', name: 'Brezalkoholne', icon: '🥤', color: '#0ea5e9', categoryIds: categoriesForMenu.filter(c => ['Vode', 'Naravni Sokovi', 'Sokovi', 'Gazirane Pijače'].includes(c.name)).map(c => c.id) },
  ]
}

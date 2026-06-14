'use client'

import { memo } from 'react'
import type { MenuType, SuperGroupType } from './MenuBrowser'

// ============================================
// TIPI
// ============================================
export interface MenuCategoryNavProps {
  menus: MenuType[] | undefined
  resolvedMenuId: string | null
  activeMenuId: string | null
  setActiveMenuId: (_menuId: string | null) => void
  categoriesForMenu: { id: string; name: string; icon: string; color: string; menuItems: unknown[] }[]
  activeCategory: string
  setActiveCategory: (_cat: string) => void
  activeSuperGroup: string
  setActiveSuperGroup: (_sg: string) => void
  superGroups: SuperGroupType[]
}

// ============================================
// MENU CATEGORY NAV - Zavihki menija + kategorije
// ============================================
export const MenuCategoryNav = memo(function MenuCategoryNav({
  menus,
  resolvedMenuId,
  setActiveMenuId,
  setActiveCategory,
  setActiveSuperGroup,
  categoriesForMenu,
  activeCategory,
  activeSuperGroup,
  superGroups,
}: MenuCategoryNavProps) {
  return (
    <>
      {/* MENU TABS - Toast Style (Food / Drinks) */}
      <div className="flex gap-1.5 px-4 py-2.5 border-b border-border flex-shrink-0">
        {menus?.map((menu: MenuType, idx: number) => {
          const isActive = resolvedMenuId === menu.id || (!resolvedMenuId && idx === 0)
          return (
            <button
              key={menu.id}
              onClick={() => { setActiveMenuId(menu.id); setActiveCategory('all'); setActiveSuperGroup('all') }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-base font-bold transition-all duration-150 ${
                isActive
                  ? 'text-white shadow-md scale-[1.02]'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
              style={isActive ? { backgroundColor: menu.color } : {}}
            >
              <span className="text-lg">{menu.icon}</span>
              {menu.name}
            </button>
          )
        })}
      </div>

      {/* CATEGORY NAVIGATION - Smart layout for large category counts */}
      {categoriesForMenu.length > 10 ? (
        /* GROUPED CATEGORIES for drinks menu (21 categories) */
        <div className="border-b border-border flex-shrink-0">
          {/* Super-group tabs */}
          <div className="flex gap-1 px-4 py-1.5 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => { setActiveCategory('all'); setActiveSuperGroup('all') }}
              className={`flex-shrink-0 px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                activeCategory === 'all' && activeSuperGroup === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              Vse
            </button>
            {superGroups.map((sg) => (
              <button
                key={sg.id}
                onClick={() => { setActiveSuperGroup(sg.id); setActiveCategory('all') }}
                className={`flex-shrink-0 px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  activeSuperGroup === sg.id
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
                style={activeSuperGroup === sg.id ? { backgroundColor: sg.color } : {}}
              >
                {sg.icon} {sg.name}
              </button>
            ))}
          </div>
          {/* Sub-categories within active super-group */}
          {activeSuperGroup !== 'all' && (
            <div className="flex gap-1 px-4 py-1.5 overflow-x-auto custom-scrollbar">
              {categoriesForMenu
                .filter((cat) => {
                  const sg = superGroups.find(s => s.categoryIds.includes(cat.id))
                  return sg?.id === activeSuperGroup
                })
                .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                      activeCategory === cat.id
                        ? 'text-white'
                        : 'bg-muted/60 text-muted-foreground hover:bg-accent'
                    }`}
                    style={activeCategory === cat.id ? { backgroundColor: cat.color || '#6b7280' } : {}}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : (
        /* SIMPLE PILLS for food menu (8 categories) */
        <div className="flex gap-1.5 px-4 py-2 border-b border-border overflow-x-auto flex-shrink-0 custom-scrollbar">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Vse
          </button>
          {categoriesForMenu.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === cat.id
                  ? 'text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
              style={activeCategory === cat.id ? { backgroundColor: cat.color || '#6b7280' } : {}}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}
    </>
  )
})

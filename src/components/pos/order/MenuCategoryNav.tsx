'use client'

import { memo } from 'react'
import type { MenuType, SuperGroupType } from './types'
import { cn } from '@/lib/utils'

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

// UI-REFACTOR (Sales P0): velike barvne kartice menijev (flex-1 + scale + DB barva)
// so zmanjšale prostor artiklov in ustvarjale vizualni šum — zdaj kompakten
// SEGMENTED CONTROL. Kategorije: enoten nevtralen pill sistem (aktivna = primary
// poudarek) namesto vsak-kategorija-svoja-barva ("mavrica"). Logika izbire
// (meni/kategorija/super-skupina, reset filterov) je NESPREMENJENA.

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
      {/* MENU TABS — kompakten segmented control (Hrana / Pijača) */}
      <div className="flex px-3 py-2 border-b border-border flex-shrink-0">
        <div
          role="tablist"
          aria-label="Meniji"
          className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5 mx-auto"
        >
          {menus?.map((menu: MenuType, idx: number) => {
            const isActive = resolvedMenuId === menu.id || (!resolvedMenuId && idx === 0)
            return (
              <button
                key={menu.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => { setActiveMenuId(menu.id); setActiveCategory('all'); setActiveSuperGroup('all') }}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold transition-all duration-150 pointer-coarse:py-2 pointer-coarse:px-5 pointer-coarse:text-base',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span aria-hidden="true" className={cn('text-base', isActive && 'grayscale-0')}>{menu.icon}</span>
                {menu.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* CATEGORY NAVIGATION — enoten pill sistem (vertical scroll ni okviran) */}
      {categoriesForMenu.length > 10 ? (
        /* GROUPED CATEGORIES for drinks menu (21 categories) */
        <div className="border-b border-border flex-shrink-0">
          {/* Super-group tabs */}
          <div className="flex gap-1 px-3 py-1.5 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => { setActiveCategory('all'); setActiveSuperGroup('all') }}
              aria-pressed={activeCategory === 'all' && activeSuperGroup === 'all'}
              className={cn(
                'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-colors pointer-coarse:px-3.5 pointer-coarse:py-1.5',
                activeCategory === 'all' && activeSuperGroup === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              Vse
            </button>
            {superGroups.map((sg) => (
              <button
                key={sg.id}
                aria-pressed={activeSuperGroup === sg.id}
                onClick={() => { setActiveSuperGroup(sg.id); setActiveCategory('all') }}
                className={cn(
                  'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-colors pointer-coarse:px-3.5 pointer-coarse:py-1.5',
                  activeSuperGroup === sg.id
                    ? 'bg-foreground text-background'
                    : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {sg.icon} {sg.name}
              </button>
            ))}
          </div>
          {/* Sub-categories within active super-group */}
          {activeSuperGroup !== 'all' && (
            <div className="flex gap-1 px-3 py-1.5 overflow-x-auto custom-scrollbar">
              {categoriesForMenu
                .filter((cat) => {
                  const sg = superGroups.find(s => s.categoryIds.includes(cat.id))
                  return sg?.id === activeSuperGroup
                })
                .map((cat) => (
                  <button
                    key={cat.id}
                    aria-pressed={activeCategory === cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors pointer-coarse:py-1.5',
                      activeCategory === cat.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : (
        /* SIMPLE PILLS for food menu (8 categories) */
        <div className="flex gap-1.5 px-3 py-2 border-b border-border overflow-x-auto flex-shrink-0 custom-scrollbar">
          <button
            onClick={() => setActiveCategory('all')}
            aria-pressed={activeCategory === 'all'}
            className={cn(
              'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors pointer-coarse:py-2',
              activeCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            Vse
          </button>
          {categoriesForMenu.map((cat) => (
            <button
              key={cat.id}
              aria-pressed={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors pointer-coarse:py-2',
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}
    </>
  )
})

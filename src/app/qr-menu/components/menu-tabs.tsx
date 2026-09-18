'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { Menu, Category, TimeOfDay } from '../types';

export interface MenuTabsProps {
  menus: Menu[];
  activeMenu: string;
  isDark: boolean;
  onMenuSelect: (_menuId: string, _menu: Menu) => void;
}

export const MenuTabs = memo(function MenuTabs({
  menus,
  activeMenu,
  isDark,
  onMenuSelect,
}: MenuTabsProps) {
  return (
    <nav className="max-w-lg mx-auto px-4 pt-3" aria-label="Izbira menija">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="tablist">
        {menus.map(menu => (
          <button
            key={menu.id}
            role="tab"
            aria-selected={activeMenu === menu.id}
            aria-controls={`panel-${menu.id}`}
            onClick={() => onMenuSelect(menu.id, menu)}
            className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
              activeMenu === menu.id
                ? `${isDark ? 'bg-amber-500 text-gray-900 shadow-lg shadow-amber-500/30' : 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'}`
                : `${isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white/70 text-amber-700 hover:bg-white shadow-sm'}`
            }`}
          >
            {menu.icon} {menu.name}
          </button>
        ))}
      </div>
    </nav>
  );
});

/** R48: meri višino sticky glave (role="banner") — kategorije se prilepijo
 *  TOČNO pod njo. Višina je spremenljiva (toggles, fontSize EAA xl → višji
 *  naslov, wrapped badges), zato fiksen top-x ne zadošča: ResizeObserver
 *  posodobi offset v živo. SSR-safe (samo v effect; glava je dynamic ssr:false). */
function useStickyTopOffset(selector: string): number {
  const [top, setTop] = useState(0);
  useEffect(() => {
    const el = document.querySelector(selector);
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setTop(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selector]);
  return top;
}

export interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string;
  isDark: boolean;
  isHighContrast: boolean;
  timeOfDay: TimeOfDay;
  onCategorySelect: (_categoryId: string) => void;
}

export const CategoryTabs = memo(function CategoryTabs({
  categories,
  activeCategory,
  isDark,
  isHighContrast,
  timeOfDay,
  onCategorySelect,
}: CategoryTabsProps) {
  const stickyTop = useStickyTopOffset('header[role="banner"]');

  // R48: aktivni chip se vedno vrti v vidni del vrstice (scrollIntoView) —
  // ob izbiri menija se kategorija nastavi PROGRAMSKO (promoted prefix) in
  // je lahko čisto zunaj prikazanega okna vrstice; prej je aktivni chip
  // ostal izven viewporta brez kakršne koli indikacije.
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  useEffect(() => {
    const el = tabRefs.current.get(activeCategory);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeCategory]);

  if (categories.length === 0) return null;

  return (
    <nav
      className={`sticky z-30 ${isDark ? 'bg-gray-950/85 backdrop-blur-md border-b border-gray-800/60' : isHighContrast ? 'bg-white border-b-2 border-black' : 'bg-amber-50/85 backdrop-blur-md border-b border-amber-200/60'} shadow-sm`}
      style={{ top: `${stickyTop}px` }}
      aria-label="Kategorije menija"
    >
      <div className="max-w-lg mx-auto px-4 py-2">
        <div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-proximity scroll-px-4"
          role="tablist"
        >
          {categories.map(cat => {
            const isPromoted = timeOfDay.promotedPrefix.some(p => cat.name.startsWith(p));
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                ref={el => {
                  if (el) tabRefs.current.set(cat.id, el);
                  else tabRefs.current.delete(cat.id);
                }}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onCategorySelect(cat.id)}
                className={`flex-shrink-0 snap-start px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? `${isDark ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : isHighContrast ? 'bg-black text-white border-2 border-black' : 'bg-amber-100 text-amber-800 border border-amber-300 shadow-sm'}`
                    : `${isDark ? 'bg-gray-800/50 text-gray-500 border border-transparent hover:bg-gray-800' : 'bg-white/40 text-gray-500 border border-transparent hover:bg-white/80'}`
                } ${isPromoted && !isActive ? 'ring-1 ring-amber-400/50' : ''}`}
              >
                {cat.icon} {cat.name}
                <span className={`ml-1 text-[10px] tabular-nums ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  ({cat.menuItems.length})
                </span>
                {isPromoted && <span className="ml-1 text-[9px]" aria-label="Priporočeno za ta čas">✨</span>}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});

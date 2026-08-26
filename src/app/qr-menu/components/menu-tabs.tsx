'use client';

import { memo } from 'react';
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
  if (categories.length === 0) return null;

  return (
    <nav className="max-w-lg mx-auto px-4 pb-2" aria-label="Kategorije menija">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="tablist">
        {categories.map(cat => {
          const isPromoted = timeOfDay.promotedPrefix.some(p => cat.name.startsWith(p));
          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={activeCategory === cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeCategory === cat.id
                  ? `${isDark ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : isHighContrast ? 'bg-black text-white border-2 border-black' : 'bg-amber-100 text-amber-800 border border-amber-300 shadow-sm'}`
                  : `${isDark ? 'bg-gray-800/50 text-gray-500 border border-transparent hover:bg-gray-800' : 'bg-white/40 text-gray-500 border border-transparent hover:bg-white/80'}`
              } ${isPromoted && activeCategory !== cat.id ? 'ring-1 ring-amber-400/50' : ''}`}
            >
              {cat.icon} {cat.name}
              <span className={`ml-1 text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                ({cat.menuItems.length})
              </span>
              {isPromoted && <span className="ml-1 text-[9px]" aria-label="Priporočeno za ta čas">✨</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
});

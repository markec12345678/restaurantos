'use client';

import { memo } from 'react';
import type { MenuItem, UpsellSuggestion } from '../types';

export interface UpsellSuggestionsProps {
  suggestions: UpsellSuggestion[];
  isDark: boolean;
  upsellLoading: boolean;
  showCart: boolean;
  cartItemCount: number;
  currentMenu: { categories: { menuItems: MenuItem[] }[] } | undefined;
  onAddToCart: (_item: MenuItem) => void;
}

export const UpsellSuggestions = memo(function UpsellSuggestions({
  suggestions,
  isDark,
  upsellLoading,
  showCart,
  cartItemCount,
  currentMenu,
  onAddToCart,
}: UpsellSuggestionsProps) {
  if (suggestions.length === 0 || showCart || cartItemCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-20 max-w-lg mx-auto" role="complementary" aria-label="Predlogi za dopolnitev naročila">
      <div className={`${isDark ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-amber-200'} backdrop-blur-xl rounded-2xl border shadow-xl p-3`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm" aria-hidden="true">🤖</span>
          <p className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Priporočamo</p>
          {upsellLoading && <svg className="animate-spin w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {suggestions.slice(0, 3).map((sug, i) => (
            <button
              key={i}
              onClick={() => {
                const found = currentMenu?.categories.flatMap(c => c.menuItems).find(item => item.id === sug.menuItemId);
                if (found) onAddToCart(found);
              }}
              className={`flex-shrink-0 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-amber-50 hover:bg-amber-100'} rounded-xl p-2.5 text-left transition min-w-[160px]`}
              aria-label={`${sug.name} €${(sug.price * 1.22).toFixed(2)}. ${sug.reason}`}
            >
              <p className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{sug.name}</p>
              <p className={`text-[10px] mt-0.5 line-clamp-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{sug.reason}</p>
              <p className={`text-xs font-bold mt-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>+€{(sug.price * 1.22).toFixed(2)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

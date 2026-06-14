'use client';

import { memo, type RefObject } from 'react';
import type { MenuItem, CartItem } from '../types';
import type { FontSize } from '../use-qr-menu';
import { ALLERGEN_DATA, VAT_LABELS } from '../constants';

export interface MenuItemListProps {
  items: MenuItem[];
  cart: CartItem[];
  isDark: boolean;
  isHighContrast: boolean;
  fontSize: FontSize;
  searchQuery: string;
  mainRef: RefObject<HTMLDivElement | null>;
  categoryName: string;
  onOpenItemDetail: (_item: MenuItem) => void;
  onAddToCart: (_item: MenuItem) => void;
}

export const MenuItemList = memo(function MenuItemList({
  items,
  cart,
  isDark,
  isHighContrast,
  fontSize,
  searchQuery,
  mainRef,
  categoryName,
  onOpenItemDetail,
  onAddToCart,
}: MenuItemListProps) {
  return (
    <main id="main-content" ref={mainRef} tabIndex={-1} className="max-w-lg mx-auto px-4 pb-28 space-y-3 outline-none" role="tabpanel" aria-label={`Jedi v kategoriji ${categoryName}`}>
      {items.map(item => {
        const allergenNums = item.allergens ? item.allergens.split(',').filter(Boolean) : [];
        const inCart = cart
          .filter(c => c.menuItem.id === item.id)
          .reduce((s, c) => s + c.quantity, 0);
        return (
          <article
            key={item.id}
            className={`${isDark ? 'bg-gray-900/80 border-gray-800' : isHighContrast ? 'bg-white border-2 border-black' : 'bg-white/70 border-white/50'} backdrop-blur-xl rounded-2xl border shadow-sm flex active:scale-[0.98] transition-all duration-150 cursor-pointer hover:shadow-md overflow-hidden`}
            onClick={() => onOpenItemDetail(item)}
            role="button"
            tabIndex={0}
            aria-label={`${item.name}, €${(item.price * (1 + item.vatRate / 100)).toFixed(2)} z DDV${allergenNums.length > 0 ? `. Alergeni: ${allergenNums.map(a => ALLERGEN_DATA[a.trim()]?.label || a).join(', ')}` : ''}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenItemDetail(item); } }}
          >
            {/* ===== ITEM IMAGE ===== */}
            {item.image ? (
              <div className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 relative">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            ) : (
              <div className={`flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-amber-50'}`}>
                <span className="text-3xl" aria-hidden="true">🍽</span>
              </div>
            )}
            <div className="flex-1 min-w-0 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className={`font-bold ${fontSize === 'xl' ? 'text-lg' : 'text-base'} leading-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                  {item.name}
                </h3>
                {inCart > 0 && (
                  <span className="flex-shrink-0 bg-amber-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" aria-label={`${inCart}x v košarici`}>
                    {inCart}
                  </span>
                )}
              </div>
              {item.description && (
                <p className={`text-sm mt-0.5 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {item.description}
                </p>
              )}
              {/* ===== ALLERGENI 2.0: Vizualno poudarjeni (EU 1169/2011) ===== */}
              {allergenNums.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5" role="list" aria-label="Alergeni">
                  {allergenNums.map(a => {
                    const aData = ALLERGEN_DATA[a.trim()];
                    if (!aData) return null;
                    return (
                      <span key={a} role="listitem"
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${isHighContrast ? aData.highContrastColor : aData.color}`}
                        aria-label={aData.label}
                      >
                        {aData.icon} {aData.label}
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Quick add + price */}
              <div className="flex items-end justify-between gap-2 mt-2">
                <div className="flex items-baseline gap-2">
                  <span className={`font-bold ${fontSize === 'xl' ? 'text-2xl' : fontSize === 'large' ? 'text-xl' : 'text-lg'} ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                    €{(item.price * (1 + item.vatRate / 100)).toFixed(2)}
                  </span>
                  <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    {VAT_LABELS[item.vatRate] || `${item.vatRate}%`}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddToCart(item); }}
                  className={`${isDark ? 'bg-amber-500 hover:bg-amber-400' : 'bg-amber-500 hover:bg-amber-600'} text-white rounded-xl p-2.5 shadow-md shadow-amber-500/20 active:scale-90 transition-all`}
                  aria-label={`Dodaj ${item.name} v košarico`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </article>
        );
      })}
      {items.length === 0 && (
        <div className="text-center py-12" role="status">
          <p className="text-4xl mb-2" aria-hidden="true">🔍</p>
          <p className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {searchQuery ? `Ni rezultatov za "${searchQuery}"` : 'Kategorija je prazna'}
          </p>
        </div>
      )}
    </main>
  );
});

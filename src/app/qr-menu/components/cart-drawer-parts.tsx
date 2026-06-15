'use client';

import { memo } from 'react';
import type { CartItem, Menu, UpsellSuggestion } from '../types';
import { ALLERGEN_DATA } from '../constants';

// ============================================
// Cart item row sub-component
// ============================================

interface CartItemRowProps {
  item: CartItem;
  index: number;
  isDark: boolean;
  isHighContrast: boolean;
  onUpdateQuantity: (_index: number, _delta: number) => void;
  onRemoveFromCart: (_index: number) => void;
}

export const CartItemRow = memo(function CartItemRow({
  item, index, isDark, isHighContrast, onUpdateQuantity, onRemoveFromCart,
}: CartItemRowProps) {
  const modTotal = item.selectedModifiers.reduce((s, m) => s + m.price, 0);
  const unitPrice = item.menuItem.price + modTotal;
  const vatMultiplier = 1 + item.menuItem.vatRate / 100;

  return (
    <div className={`flex items-center gap-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-xl p-3`} role="listitem">
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.menuItem.name}</p>
        {item.selectedModifiers.length > 0 && (
          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            +{item.selectedModifiers.map(m => m.name).join(', ')}
          </p>
        )}
        {item.notes && (
          <p className={`text-xs mt-0.5 italic ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            📝 {item.notes}
          </p>
        )}
        {item.menuItem.allergens && (
          <div className="flex flex-wrap gap-0.5 mt-1">
            {item.menuItem.allergens.split(',').filter(Boolean).map(a => {
              const aData = ALLERGEN_DATA[a.trim()];
              return aData ? (
                <span key={a} className={`text-[8px] px-1 py-0.5 rounded border ${isHighContrast ? aData.highContrastColor : aData.color}`}>
                  {aData.icon} {aData.label}
                </span>
              ) : null;
            })}
          </div>
        )}
        <p className={`text-sm font-bold mt-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
          €{(unitPrice * vatMultiplier).toFixed(2)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdateQuantity(index, -1)}
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition ${
            isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
          aria-label={`Zmanjšaj količino ${item.menuItem.name}`}
        >
          −
        </button>
        <span className={`w-6 text-center font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`} aria-label={`Količina: ${item.quantity}`}>{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(index, 1)}
          className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm font-bold hover:bg-amber-600 transition"
          aria-label={`Povečaj količino ${item.menuItem.name}`}
        >
          +
        </button>
      </div>
      <button
        onClick={() => onRemoveFromCart(index)}
        className="text-red-400 hover:text-red-600 ml-1"
        aria-label={`Odstrani ${item.menuItem.name}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );
});

// ============================================
// AI Upsell section sub-component
// ============================================

interface UpsellSectionProps {
  upsellSuggestions: UpsellSuggestion[];
  currentMenu: Menu | undefined;
  isDark: boolean;
  onAddToCart: (_item: CartItem['menuItem']) => void;
}

export const UpsellSection = memo(function UpsellSection({
  upsellSuggestions, currentMenu, isDark, onAddToCart,
}: UpsellSectionProps) {
  if (upsellSuggestions.length === 0) return null;
  return (
    <div className={`px-4 py-2 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs" aria-hidden="true">🤖</span>
        <p className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Morda bi želeli še</p>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {upsellSuggestions.slice(0, 2).map((sug, i) => (
          <button
            key={i}
            onClick={() => {
              const found = currentMenu?.categories.flatMap(c => c.menuItems).find(item => item.id === sug.menuItemId);
              if (found) onAddToCart(found);
            }}
            className={`flex-shrink-0 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-amber-50 hover:bg-amber-100'} rounded-xl px-3 py-2 text-left transition min-w-[140px]`}
            aria-label={`${sug.name} €${(sug.price * 1.22).toFixed(2)}`}
          >
            <p className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{sug.name}</p>
            <p className={`text-[10px] line-clamp-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{sug.reason}</p>
          </button>
        ))}
      </div>
    </div>
  );
});

// ============================================
// Cart footer totals + order button
// ============================================

interface CartTotalsFooterProps {
  totalWithoutVat: number;
  totalWithVat: number;
  isDark: boolean;
  orderSending: boolean;
  onPlaceOrder: () => Promise<void>;
}

export const CartTotalsFooter = memo(function CartTotalsFooter({
  totalWithoutVat, totalWithVat, isDark, orderSending, onPlaceOrder,
}: CartTotalsFooterProps) {
  return (
    <div className={`border-t ${isDark ? 'border-gray-800' : 'border-gray-100'} p-4 space-y-3`}>
      <div className="space-y-1">
        <div className={`flex justify-between text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <span>Znesek brez DDV</span>
          <span>€{totalWithoutVat.toFixed(2)}</span>
        </div>
        <div className={`flex justify-between text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <span>DDV</span>
          <span>€{(totalWithVat - totalWithoutVat).toFixed(2)}</span>
        </div>
        <div className={`flex justify-between text-lg font-bold pt-1 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
          <span>Skupaj</span>
          <span>€{totalWithVat.toFixed(2)}</span>
        </div>
      </div>
      <button
        onClick={onPlaceOrder}
        disabled={orderSending}
        className={`w-full py-4 rounded-2xl font-bold text-lg transition shadow-lg active:scale-[0.98] ${
          orderSending
            ? 'bg-gray-400 text-gray-600 cursor-not-allowed shadow-none'
            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/30'
        }`}
        aria-label={`Naroči za €${totalWithVat.toFixed(2)}`}
      >
        {orderSending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Pošiljam...
          </span>
        ) : (
          `Naroči · €${totalWithVat.toFixed(2)}`
        )}
      </button>
    </div>
  );
});

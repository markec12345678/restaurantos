'use client';

import { memo } from 'react';
import type { CartItem, Menu, UpsellSuggestion } from '../types';
import { safeToFixed, safeNum } from '@/lib/safe-format'

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
            aria-label={`${sug.name} €${safeToFixed(sug.price * 1.22, 2)}`}
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
          <span>€{safeToFixed(totalWithoutVat, 2)}</span>
        </div>
        <div className={`flex justify-between text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <span>DDV</span>
          <span>€{safeToFixed(totalWithVat - totalWithoutVat, 2)}</span>
        </div>
        <div className={`flex justify-between text-lg font-bold pt-1 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
          <span>Skupaj</span>
          <span>€{safeToFixed(totalWithVat, 2)}</span>
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
        aria-label={`Naroči za €${safeToFixed(totalWithVat, 2)}`}
      >
        {orderSending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Pošiljam...
          </span>
        ) : (
          `Naroči · €${safeToFixed(totalWithVat, 2)}`
        )}
      </button>
    </div>
  );
});

'use client';

import { memo } from 'react';
import type { CartItem } from '../types';
import { ALLERGEN_DATA } from '../constants';
import { safeToFixed, safeNum } from '@/lib/safe-format'

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
          €{safeToFixed(unitPrice * vatMultiplier, 2)}
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

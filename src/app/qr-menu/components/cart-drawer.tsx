'use client';

import { memo, type RefObject } from 'react';
import type { CartItem, Menu, UpsellSuggestion } from '../types';
import { ALLERGEN_DATA } from '../constants';

export interface CartDrawerProps {
  cart: CartItem[];
  isDark: boolean;
  isHighContrast: boolean;
  showCart: boolean;
  cartItemCount: number;
  totalWithoutVat: number;
  totalWithVat: number;
  orderSending: boolean;
  upsellSuggestions: UpsellSuggestion[];
  currentMenu: Menu | undefined;
  cartDrawerRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onUpdateQuantity: (_index: number, _delta: number) => void;
  onRemoveFromCart: (_index: number) => void;
  onPlaceOrder: () => Promise<void>;
  onAddToCart: (_item: CartItem['menuItem']) => void;
}

export const CartDrawer = memo(function CartDrawer({
  cart,
  isDark,
  isHighContrast,
  showCart,
  cartItemCount,
  totalWithoutVat,
  totalWithVat,
  orderSending,
  upsellSuggestions,
  currentMenu,
  cartDrawerRef,
  onClose,
  onUpdateQuantity,
  onRemoveFromCart,
  onPlaceOrder,
  onAddToCart,
}: CartDrawerProps) {
  if (!showCart) return null;

  return (
    <div ref={cartDrawerRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Vaše naročilo" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`absolute bottom-0 left-0 right-0 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col`}>
        {/* Cart header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold" id="cart-title">Vaše naročilo</h2>
            {cartItemCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5" aria-label={`${cartItemCount} izdelkov`}>{cartItemCount}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Zapri košarico">&times;</button>
        </div>
        {cart.length === 0 ? (
          <div className="p-8 text-center" role="status">
            <p className="text-5xl mb-3" aria-hidden="true">🍽️</p>
            <p className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Vaša košarica je prazna</p>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Tapnite + za dodajanje</p>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div className="flex-1 overflow-auto p-4 space-y-2" aria-label="Postavke naročila">
              {cart.map((item, index) => {
                const modTotal = item.selectedModifiers.reduce((s, m) => s + m.price, 0);
                const unitPrice = item.menuItem.price + modTotal;
                const vatMultiplier = 1 + item.menuItem.vatRate / 100;
                return (
                  <div key={index} className={`flex items-center gap-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-xl p-3`} role="listitem">
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
                      {/* Alergeni v košarici */}
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
              })}
            </div>
            {/* AI Upsell in cart */}
            {upsellSuggestions.length > 0 && (
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
            )}
            {/* Cart footer */}
            <div className={`border-t ${isDark ? 'border-gray-800' : 'border-gray-100'} p-4 space-y-3`}>
              {/* Subtotal breakdown */}
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
          </>
        )}
      </div>
    </div>
  );
});

export interface FloatingCartBarProps {
  cartItemCount: number;
  totalWithVat: number;
  onClick: () => void;
}

export const FloatingCartBar = memo(function FloatingCartBar({
  cartItemCount,
  totalWithVat,
  onClick,
}: FloatingCartBarProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 max-w-lg mx-auto">
      <button
        onClick={onClick}
        className="w-full bg-amber-500 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-2xl shadow-amber-500/40 flex items-center justify-between active:scale-[0.98] transition hover:bg-amber-600"
        aria-label={`Poglej košarico, ${cartItemCount} izdelkov, skupaj €${totalWithVat.toFixed(2)}`}
      >
        <span className="flex items-center gap-2">
          <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm font-bold">{cartItemCount}</span>
          Poglej košarico
        </span>
        <span>€{totalWithVat.toFixed(2)}</span>
      </button>
    </div>
  );
});

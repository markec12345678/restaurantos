'use client';

import { memo } from 'react';
import type { CartItem } from '../types';
import { CartItemRow, UpsellSection, CartTotalsFooter } from './cart-drawer-parts';

// ============================================
// EMPTY CART VIEW
// ============================================
interface EmptyCartStateProps {
  isDark: boolean;
}

export const EmptyCartState = memo(function EmptyCartState({ isDark }: EmptyCartStateProps) {
  return (
    <div className="p-8 text-center" role="status">
      <p className="text-5xl mb-3" aria-hidden="true">🍽️</p>
      <p className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Vaša košarica je prazna</p>
      <p className={`text-sm mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Tapnite + za dodajanje</p>
    </div>
  );
});

// ============================================
// CART HEADER SUB-COMPONENT
// ============================================
interface CartHeaderProps {
  cartItemCount: number;
  isDark: boolean;
  onClose: () => void;
}

export const CartHeader = memo(function CartHeader({ cartItemCount, isDark, onClose }: CartHeaderProps) {
  return (
    <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold" id="cart-title">Vaše naročilo</h2>
        {cartItemCount > 0 && (
          <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5" aria-label={`${cartItemCount} izdelkov`}>{cartItemCount}</span>
        )}
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Zapri košarico">&times;</button>
    </div>
  );
});

// ============================================
// FLOATING CART BAR
// ============================================
interface FloatingCartBarProps {
  cartItemCount: number;
  totalWithVat: number;
  onClick: () => void;
}

export const FloatingCartBar = memo(function FloatingCartBar({ cartItemCount, totalWithVat, onClick }: FloatingCartBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onClick}
          className="w-full flex items-center justify-between bg-amber-500 hover:bg-amber-600 text-white py-4 px-6 rounded-2xl shadow-2xl shadow-amber-500/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="bg-white text-amber-600 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">{cartItemCount}</span>
            <span className="font-semibold">Vaša košarica</span>
          </div>
          <span className="text-lg font-bold">{totalWithVat.toFixed(2)} €</span>
        </button>
      </div>
    </div>
  );
});

// ============================================
// CART DRAWER
// ============================================
export interface CartDrawerProps {
  cart: CartItem[];
  isDark: boolean;
  isHighContrast: boolean;
  showCart: boolean;
  cartItemCount: number;
  totalWithoutVat: number;
  totalWithVat: number;
  orderSending: boolean;
  upsellSuggestions: import('../types').UpsellSuggestion[];
  currentMenu: import('../types').Menu | undefined;
  cartDrawerRef: import('react').RefObject<HTMLDivElement | null>;
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
        <CartHeader cartItemCount={cartItemCount} isDark={isDark} onClose={onClose} />
        {cart.length === 0 ? (
          <EmptyCartState isDark={isDark} />
        ) : (
          <>
            <div className="flex-1 overflow-auto p-4 space-y-2" aria-label="Postavke naročila">
              {cart.map((item, index) => (
                <CartItemRow key={index} item={item} index={index} isDark={isDark} isHighContrast={isHighContrast} onUpdateQuantity={onUpdateQuantity} onRemoveFromCart={onRemoveFromCart} />
              ))}
            </div>
            <UpsellSection upsellSuggestions={upsellSuggestions} currentMenu={currentMenu} isDark={isDark} onAddToCart={onAddToCart} />
            <CartTotalsFooter totalWithoutVat={totalWithoutVat} totalWithVat={totalWithVat} isDark={isDark} orderSending={orderSending} onPlaceOrder={onPlaceOrder} />
          </>
        )}
      </div>
    </div>
  );
});

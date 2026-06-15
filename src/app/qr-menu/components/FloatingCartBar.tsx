'use client';

import { memo } from 'react';

// ============================================
// FLOATING CART BAR
// ============================================
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

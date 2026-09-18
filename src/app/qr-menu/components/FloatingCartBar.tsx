'use client';

import { memo } from 'react';
import { ShoppingBag } from 'lucide-react';
import { formatEUR } from '@/lib/safe-format'

// ============================================
// FLOATING CART BAR
// ============================================
// RUNDA 47: polish —
//  • iOS safe-area (env(safe-area-inset-bottom)) — gumb ni prilepljen na domov
//    gumb/gesture bar na iPhone (PWA/QR gosti)
//  • vstopna animacija (animate-fade-in-up; globals.css respektira
//    prefers-reduced-motion)
//  • ShoppingBag ikona + DDV hint v aria-labelu
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
    <div
      className="fixed left-4 right-4 z-30 max-w-lg mx-auto animate-fade-in-up"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <button
        onClick={onClick}
        className="w-full bg-amber-500 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-2xl shadow-amber-500/40 flex items-center justify-between active:scale-[0.98] transition hover:bg-amber-600 focus-visible:ring-4 focus-visible:ring-amber-300/60 outline-none"
        aria-label={`Poglej košarico, ${cartItemCount} izdelkov, skupaj ${formatEUR(totalWithVat)} z DDV`}
      >
        <span className="flex items-center gap-2">
          <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums">{cartItemCount}</span>
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          Poglej košarico
        </span>
        <span className="tabular-nums">{formatEUR(totalWithVat)}</span>
      </button>
    </div>
  );
});

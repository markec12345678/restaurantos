'use client';

import { memo, type RefObject } from 'react';
import type { RestaurantSettingsRow } from '@/lib/types';
import type { TimeOfDay } from '../types';
import type { FontSize } from '../use-qr-menu';

export interface MenuHeaderProps {
  isDark: boolean;
  isHighContrast: boolean;
  fontSize: FontSize;
  settings: RestaurantSettingsRow | null;
  tableNumber: string;
  timeOfDay: TimeOfDay;
  cartItemCount: number;
  searchQuery: string;
  searchRef: RefObject<HTMLInputElement | null>;
  cartBtnRef: RefObject<HTMLButtonElement | null>;
  onFontSizeToggle: () => void;
  onHighContrastToggle: () => void;
  onDarkToggle: () => void;
  onAllergenInfoToggle: () => void;
  onCartToggle: () => void;
  onSearchChange: (_query: string) => void;
  onSkipToMain: () => void;
}

export const MenuHeader = memo(function MenuHeader({
  isDark,
  isHighContrast,
  fontSize,
  settings,
  tableNumber,
  timeOfDay,
  cartItemCount,
  searchQuery,
  searchRef,
  cartBtnRef,
  onFontSizeToggle,
  onHighContrastToggle,
  onDarkToggle,
  onAllergenInfoToggle,
  onCartToggle,
  onSearchChange,
  onSkipToMain,
}: MenuHeaderProps) {
  return (
    <>
      {/* ===== EAA: Skip to main content (WCAG 2.4.1) ===== */}
      <a href="#main-content"
        onClick={(e) => { e.preventDefault(); onSkipToMain(); }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-amber-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-xl"
      >
        Preskoči na vsebino
      </a>
      {/* ===== HEADER - Glassmorphism sticky ===== */}
      <header className={`sticky top-0 z-40 ${isDark ? 'bg-gray-900/80' : isHighContrast ? 'bg-white border-b-2 border-black' : 'bg-white/70'} backdrop-blur-xl ${isHighContrast ? '' : 'border-b'} ${isDark ? 'border-gray-800' : 'border-white/30'} shadow-lg shadow-black/5`}
        role="banner" aria-label="Glava menija">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className={`text-xl font-bold truncate ${isDark ? 'text-amber-400' : 'text-amber-900'}`}>
                {settings?.name || 'RestaurantOS'}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {tableNumber && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium" aria-label={`Miza številka ${tableNumber}`}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Miza {tableNumber}
                  </span>
                )}
                {/* Time-of-day badge */}
                <span className="inline-flex items-center gap-1 text-xs bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium" aria-label={`Čas dneva: ${timeOfDay.label}`}>
                  {timeOfDay.icon} {timeOfDay.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Font size toggle - EAA 1.4.4 Resize Text */}
              <button
                onClick={onFontSizeToggle}
                className={`p-2 rounded-xl ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-amber-100 text-amber-700'} transition active:scale-90`}
                aria-label={`Velikost pisave: ${fontSize === 'normal' ? 'Normalna' : fontSize === 'large' ? 'Velika' : 'Največja'}. Kliknite za povečavo.`}
                title="Velikost pisave"
              >
                <span className="text-sm font-bold" aria-hidden="true">Aa</span>
              </button>
              {/* High contrast toggle - EAA 1.4.3 Contrast */}
              <button
                onClick={onHighContrastToggle}
                className={`p-2 rounded-xl ${isHighContrast ? 'bg-black text-yellow-300 border-2 border-yellow-400' : isDark ? 'bg-gray-800 text-gray-400' : 'bg-amber-100 text-amber-700'} transition active:scale-90`}
                aria-label={`${isHighContrast ? 'Izklopi' : 'Vklopi'} visok kontrast`}
                title="Visok kontrast (EAA)"
              >
                <span className="text-sm" aria-hidden="true">🌓</span>
              </button>
              {/* Dark mode toggle */}
              <button
                onClick={onDarkToggle}
                className={`p-2 rounded-xl ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-amber-100 text-amber-700'} transition active:scale-90`}
                aria-label={`${isDark ? 'Svetli' : 'Temni'} način`}
                title="Temni/svetli način"
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              {/* Allergen info button - EU 1169/2011 */}
              <button
                onClick={onAllergenInfoToggle}
                className={`p-2 rounded-xl ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-orange-100 text-orange-700'} transition active:scale-90`}
                aria-label="Informacije o alergenih"
                title="Alergeni (EU 1169/2011)"
              >
                <span className="text-sm" aria-hidden="true">⚠️</span>
              </button>
              {/* Cart button */}
              <button
                ref={cartBtnRef}
                onClick={onCartToggle}
                className="relative bg-amber-500 text-white p-3 rounded-xl shadow-lg shadow-amber-500/30 hover:bg-amber-600 active:scale-90 transition"
                aria-label={`Košarica${cartItemCount > 0 ? `, ${cartItemCount} izdelkov` : ', prazna'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg animate-bounce" aria-label={`${cartItemCount} izdelkov v košarici`}>
                    {cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          {/* Search bar - EAA 1.3.1 Info and Relationships */}
          <div className="mt-2 relative">
            <label htmlFor="menu-search" className="sr-only">Išči po meniju</label>
            <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              id="menu-search"
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Išči po meniju..."
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500' : isHighContrast ? 'bg-white border-2 border-black text-black placeholder:text-gray-700' : 'bg-white/60 border-amber-200 text-gray-900 placeholder:text-amber-400'} border backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50`}
              aria-label="Iskanje po meniju"
            />
            {searchQuery && (
              <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Počisti iskanje">✕</button>
            )}
          </div>
        </div>
      </header>
    </>
  );
});

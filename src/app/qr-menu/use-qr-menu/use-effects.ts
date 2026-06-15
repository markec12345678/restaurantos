// =====================================================================
// QR Menu - Effects (init, time-of-day, upsell)
// =====================================================================

import { useEffect } from 'react';
import type { BeforeInstallPromptEvent } from '@/lib/types';
import type { Menu, CartItem, UpsellSuggestion } from '../types';
import { getTimeOfDay } from '../constants';
import type { FontSize } from './types';
import { readInitPreferences, fetchMenuData, findTimeOfDayCategory, fetchUpsellData } from './api-helpers';

export interface UseQRMenuEffectsParams {
  setMenus: (_menus: Menu[]) => void;
  setSettings: (_settings: import('@/lib/types').RestaurantSettingsRow | null) => void;
  setActiveMenu: (_id: string) => void;
  setActiveCategory: (_id: string) => void;
  setTableNumber: (_num: string) => void;
  setIsDark: (_dark: boolean) => void;
  setIsHighContrast: (_contrast: boolean) => void;
  setFontSize: (_size: FontSize) => void;
  setLoading: (_loading: boolean) => void;
  setError: (_error: string) => void;
  setTimeOfDay: (_tod: ReturnType<typeof getTimeOfDay>) => void;
  setUpsellLoading: (_loading: boolean) => void;
  setUpsellSuggestions: (_suggestions: UpsellSuggestion[]) => void;
  cart: CartItem[];
  menus: Menu[];
  activeMenu: string;
  activeCategory: string;
}

export function useQRMenuEffects({
  setMenus,
  setSettings,
  setActiveMenu,
  setActiveCategory,
  setTableNumber,
  setIsDark,
  setIsHighContrast,
  setFontSize,
  setLoading,
  setError,
  setTimeOfDay,
  setUpsellLoading,
  setUpsellSuggestions,
  cart,
  menus,
  activeMenu,
  activeCategory,
}: UseQRMenuEffectsParams) {
  // Init: fetch menu, read preferences, register PWA prompt
  useEffect(() => {
    (async () => {
      try {
        const prefs = readInitPreferences();
        if (prefs.tableParam) setTableNumber(prefs.tableParam);
        setIsDark(prefs.prefersDark);
        setIsHighContrast(prefs.prefersContrast);
        if (prefs.savedFontSize) setFontSize(prefs.savedFontSize);

        const result = await fetchMenuData();
        if (result) {
          setMenus(result.menus as Menu[]);
          setSettings(result.settings as import('@/lib/types').RestaurantSettingsRow);
          setActiveMenu(result.initialMenuId);
          const tod = getTimeOfDay(new Date().getHours());
          const catId = findTimeOfDayCategory(
            (result.menus as Menu[])[0]?.categories,
            tod.promotedPrefix,
          );
          setActiveCategory(catId || result.initialCategoryId);
        }
      } catch {
        setError('Napaka pri nalaganju menija. Poskusite znova.');
      } finally {
        setLoading(false);
      }
    })();

    const handler = (e: Event) => {
      e.preventDefault();
      window.deferredPrompt = e as BeforeInstallPromptEvent;
    };
    window.addEventListener('beforeinstallprompt' as keyof WindowEventMap, handler as EventListener);
    return () => {
      window.removeEventListener('beforeinstallprompt' as keyof WindowEventMap, handler as EventListener);
    };
  }, [setMenus, setSettings, setActiveMenu, setActiveCategory, setTableNumber, setIsDark, setIsHighContrast, setFontSize, setLoading, setError]);

  // Time-of-day update vsakih 5 minut
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay(new Date().getHours()));
    }, 300000);
    return () => clearInterval(interval);
  }, [setTimeOfDay]);

  // AI Upsell: ko se košarica spremeni
  useEffect(() => {
    if (cart.length > 0) {
      (async () => {
        setUpsellLoading(true);
        try {
          const currentCat = menus.find(m => m.id === activeMenu)?.categories.find(c => c.id === activeCategory);
          const suggestions = await fetchUpsellData(cart, currentCat?.name || '');
          setUpsellSuggestions(suggestions);
        } catch { /* Upsell is optional */ } finally { setUpsellLoading(false); }
      })();
    } else {
      setUpsellSuggestions([]);
    }
  }, [cart.length, activeCategory, menus, activeMenu, setUpsellLoading, setUpsellSuggestions]);
}

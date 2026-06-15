// =====================================================================
// QR Menu - Main hook za stanje in logiko
// =====================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BeforeInstallPromptEvent } from '@/lib/types';
import { useFocusTrap } from '@/lib/use-focus-trap';
import type { Menu, MenuItem, Modifier, ModifierGroup, CartItem, OrderResult, UpsellSuggestion } from '../types';
import { getTimeOfDay } from '../constants';
import type { FontSize, QRMenuState } from './types';
import { addItemToCart, removeCartItemByIndex, updateCartItemQuantity, calculateCartTotal, calculateCartTotalWithVat, getCartItemCount } from './cart-utils';
import { toggleModifierLogic, validateModifierGroupsLogic, filterItemsBySearch, reorderCategoriesByTimeOfDay } from './modifier-utils';
import { readInitPreferences, fetchMenuData, findTimeOfDayCategory, fetchUpsellData, submitOrderRequest } from './api-helpers';

export type { FontSize } from './types';
export type { QRMenuState } from './types';

export function useQRMenu(): QRMenuState {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [settings, setSettings] = useState<import('@/lib/types').RestaurantSettingsRow | null>(null);
  const [activeMenu, setActiveMenu] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [tableNumber, setTableNumber] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [orderSending, setOrderSending] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('normal');
  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null);
  const [itemNotes, setItemNotes] = useState('');
  const [selectedMods, setSelectedMods] = useState<Modifier[]>([]);
  const [upsellSuggestions, setUpsellSuggestions] = useState<UpsellSuggestion[]>([]);
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay(new Date().getHours()));
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [showAllergenInfo, setShowAllergenInfo] = useState(false);
  // Refs za EAA
  const mainRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const allergenPanelRef = useFocusTrap<HTMLDivElement>(showAllergenInfo);
  const itemDetailRef = useFocusTrap<HTMLDivElement>(!!showItemDetail);
  const cartDrawerRef = useFocusTrap<HTMLDivElement>(showCart);

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
  }, []);

  // Time-of-day update vsakih 5 minut
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay(new Date().getHours()));
    }, 300000);
    return () => clearInterval(interval);
  }, []);

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
  }, [cart.length, activeCategory]);

  const addToCart = useCallback((item: MenuItem, modifiers: Modifier[] = [], notes: string = '') => {
    setCart(prev => addItemToCart(prev, item, modifiers, notes));
    setShowItemDetail(null);
    setItemNotes('');
    setSelectedMods([]);
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart(prev => removeCartItemByIndex(prev, index));
  }, []);

  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart(prev => updateCartItemQuantity(prev, index, delta));
  }, []);

  function getTotal() { return calculateCartTotal(cart); }
  function getTotalWithVat() { return calculateCartTotalWithVat(cart); }

  async function placeOrder() {
    if (cart.length === 0) return;
    setOrderSending(true);
    try {
      const result = await submitOrderRequest(tableNumber, cart);
      setOrderResult(result);
      setOrderPlaced(true);
      if (result.success) setCart([]);
      else setError('Napaka pri oddaji naročila. Poskusite znova.');
    } catch {
      setError('Napaka pri oddaji naročila. Poskusite znova.');
      setOrderResult({ success: false, error: 'Povezava ni na voljo' });
      setOrderPlaced(true);
    } finally {
      setOrderSending(false);
    }
  }

  function openItemDetail(item: MenuItem) {
    setShowItemDetail(item);
    setItemNotes('');
    setSelectedMods([]);
  }

  function toggleModifier(mod: Modifier, mg: ModifierGroup) {
    setSelectedMods(prev => toggleModifierLogic(prev, mod, mg));
  }

  function validateModifierGroups(): string | null {
    return validateModifierGroupsLogic(selectedMods, showItemDetail);
  }

  // Izpeljane vrednosti
  const currentMenu = menus.find(m => m.id === activeMenu);
  const currentCategory = currentMenu?.categories.find(c => c.id === activeCategory);
  const filteredItems = filterItemsBySearch(currentCategory?.menuItems, searchQuery);
  const reorderedCategories = reorderCategoriesByTimeOfDay(currentMenu?.categories, timeOfDay);
  const cartItemCount = getCartItemCount(cart);

  function skipToMain() { mainRef.current?.focus(); }

  return {
    menus, settings, activeMenu, activeCategory, cart, showCart, tableNumber,
    loading, orderPlaced, orderResult, orderSending, error, searchQuery,
    isDark, isHighContrast, fontSize,
    showItemDetail, itemNotes, selectedMods,
    upsellSuggestions, timeOfDay, upsellLoading, showAllergenInfo,
    mainRef, searchRef, cartBtnRef, allergenPanelRef, itemDetailRef, cartDrawerRef,
    currentMenu, currentCategory, filteredItems, reorderedCategories, cartItemCount,
    setActiveMenu, setActiveCategory, setShowCart, setOrderPlaced, setOrderResult,
    setShowItemDetail, setItemNotes, setSearchQuery, setIsDark, setIsHighContrast,
    setFontSize, setShowAllergenInfo,
    addToCart, removeFromCart, updateQuantity, getTotal, getTotalWithVat,
    placeOrder, openItemDetail, toggleModifier, validateModifierGroups,
    skipToMain, setError,
  };
}

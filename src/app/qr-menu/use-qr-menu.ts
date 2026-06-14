// =====================================================================
// QR Menu - Hook za stanje in logiko
// =====================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RestaurantSettingsRow, BeforeInstallPromptEvent } from '@/lib/types';
import { useFocusTrap } from '@/lib/use-focus-trap';
import type { Menu, Category, MenuItem, Modifier, ModifierGroup, CartItem, OrderResult, UpsellSuggestion, TimeOfDay } from './types';
import { getTimeOfDay } from './constants';

export type FontSize = 'normal' | 'large' | 'xl';

export interface QRMenuState {
  // Podatki
  menus: Menu[];
  settings: RestaurantSettingsRow | null;
  activeMenu: string;
  activeCategory: string;
  cart: CartItem[];
  showCart: boolean;
  tableNumber: string;
  loading: boolean;
  orderPlaced: boolean;
  orderResult: OrderResult | null;
  orderSending: boolean;
  error: string;
  searchQuery: string;
  // EAA 2026: Dostopnost
  isDark: boolean;
  isHighContrast: boolean;
  fontSize: FontSize;
  // Item detail modal
  showItemDetail: MenuItem | null;
  itemNotes: string;
  selectedMods: Modifier[];
  // AI Personalizacija
  upsellSuggestions: UpsellSuggestion[];
  timeOfDay: TimeOfDay;
  upsellLoading: boolean;
  showAllergenInfo: boolean;
  // Refs
  mainRef: React.RefObject<HTMLDivElement | null>;
  searchRef: React.RefObject<HTMLInputElement | null>;
  cartBtnRef: React.RefObject<HTMLButtonElement | null>;
  allergenPanelRef: React.RefObject<HTMLDivElement | null>;
  itemDetailRef: React.RefObject<HTMLDivElement | null>;
  cartDrawerRef: React.RefObject<HTMLDivElement | null>;
  // Izpeljane vrednosti
  currentMenu: Menu | undefined;
  currentCategory: Category | undefined;
  filteredItems: MenuItem[];
  reorderedCategories: Category[];
  cartItemCount: number;
  // Akcije
  setActiveMenu: (_id: string) => void;
  setActiveCategory: (_id: string) => void;
  setShowCart: (_show: boolean) => void;
  setOrderPlaced: (_placed: boolean) => void;
  setOrderResult: (_result: OrderResult | null) => void;
  setShowItemDetail: (_item: MenuItem | null) => void;
  setItemNotes: (_notes: string) => void;
  setSearchQuery: (_query: string) => void;
  setIsDark: (_dark: boolean) => void;
  setIsHighContrast: (_contrast: boolean) => void;
  setFontSize: (_size: FontSize) => void;
  setShowAllergenInfo: (_show: boolean) => void;
  addToCart: (_item: MenuItem, _modifiers?: Modifier[], _notes?: string) => void;
  removeFromCart: (_index: number) => void;
  updateQuantity: (_index: number, _delta: number) => void;
  getTotal: () => number;
  getTotalWithVat: () => number;
  placeOrder: () => Promise<void>;
  openItemDetail: (_item: MenuItem) => void;
  toggleModifier: (_mod: Modifier, _mg: ModifierGroup) => void;
  validateModifierGroups: () => string | null;
  skipToMain: () => void;
  setError: (_error: string) => void;
}

export function useQRMenu(): QRMenuState {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [settings, setSettings] = useState<RestaurantSettingsRow | null>(null);
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
  // ===== EAA 2026: Dostopnost =====
  const [isDark, setIsDark] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('normal');
  // ===== Item detail modal =====
  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null);
  const [itemNotes, setItemNotes] = useState('');
  const [selectedMods, setSelectedMods] = useState<Modifier[]>([]);
  // ===== AI Personalizacija =====
  const [upsellSuggestions, setUpsellSuggestions] = useState<UpsellSuggestion[]>([]);
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay(new Date().getHours()));
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [showAllergenInfo, setShowAllergenInfo] = useState(false);
  // ===== Refs za EAA =====
  const mainRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const allergenPanelRef = useFocusTrap<HTMLDivElement>(showAllergenInfo);
  const itemDetailRef = useFocusTrap<HTMLDivElement>(!!showItemDetail);
  const cartDrawerRef = useFocusTrap<HTMLDivElement>(showCart);

  useEffect(() => {
    fetchMenu();
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table');
    if (table) setTableNumber(table);
    // Dark mode + high contrast preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const prefersContrast = window.matchMedia('(prefers-contrast: more)').matches;
    setIsDark(prefersDark);
    setIsHighContrast(prefersContrast);
    // Font size preference
    const savedFontSize = localStorage.getItem('qr-font-size') as FontSize | null;
    if (savedFontSize) setFontSize(savedFontSize);
    // PWA install prompt
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
      fetchUpsellSuggestions();
    } else {
      setUpsellSuggestions([]);
    }
  }, [cart.length, activeCategory]);

  async function fetchMenu() {
    try {
      const res = await fetch('/api/public/menu');
      if (!res.ok) throw new Error('Meni trenutno ni na voljo');
      const data = await res.json();
      setMenus(data.menus || []);
      setSettings(data.settings || {});
      if (data.menus?.length > 0) {
        setActiveMenu(data.menus[0].id);
        // Time-of-day: izberi kategorijo glede na uro
        const tod = getTimeOfDay(new Date().getHours());
        const firstMenu = data.menus[0];
        const matchingCat = firstMenu.categories?.find((c: Category) =>
          tod.promotedPrefix.some(p => c.name.startsWith(p))
        );
        setActiveCategory(matchingCat?.id || firstMenu.categories?.[0]?.id || '');
      }
    } catch {
      setError('Napaka pri nalaganju menija. Poskusite znova.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchUpsellSuggestions() {
    if (cart.length === 0) return;
    setUpsellLoading(true);
    try {
      const cartItems = cart.map(c => ({
        menuItemId: c.menuItem.id,
        name: c.menuItem.name,
        category: currentCategory?.name || '',
        price: c.menuItem.price,
      }));
      const res = await fetch('/api/ai/qr-upsell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartItems, hour: new Date().getHours() }),
      });
      const data = await res.json();
      if (data.suggestions) {
        setUpsellSuggestions(data.suggestions.filter((s: UpsellSuggestion) =>
          !cart.find(c => c.menuItem.id === s.menuItemId)
        ));
      }
    } catch {
      // Upsell is optional — silently skip
    } finally {
      setUpsellLoading(false);
    }
  }

  const addToCart = useCallback((item: MenuItem, modifiers: Modifier[] = [], notes: string = '') => {
    setCart(prev => {
      const key = `${item.id}-${modifiers.map(m => m.id).sort().join(',')}`;
      const existing = prev.findIndex(c =>
        `${c.menuItem.id}-${c.selectedModifiers.map(m => m.id).sort().join(',')}` === key
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
        return updated;
      }
      return [...prev, { menuItem: item, quantity: 1, selectedModifiers: modifiers, notes }];
    });
    setShowItemDetail(null);
    setItemNotes('');
    setSelectedMods([]);
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: updated[index].quantity + delta };
      if (updated[index].quantity <= 0) updated.splice(index, 1);
      return updated;
    });
  }, []);

  function getTotal() {
    return cart.reduce((sum, item) => {
      const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0);
      return sum + (item.menuItem.price + modPrice) * item.quantity;
    }, 0);
  }

  function getTotalWithVat() {
    return cart.reduce((sum, item) => {
      const modPrice = item.selectedModifiers.reduce((s, m) => s + (m.price || 0), 0);
      const basePrice = item.menuItem.price + modPrice;
      const vatMultiplier = 1 + item.menuItem.vatRate / 100;
      return sum + basePrice * vatMultiplier * item.quantity;
    }, 0);
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setOrderSending(true);
    try {
      const orderItems = cart.map(item => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        price: item.menuItem.price,
        vatRate: item.menuItem.vatRate,
        notes: item.notes,
        modifiersJson: JSON.stringify(item.selectedModifiers),
      }));
      const res = await fetch('/api/public/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber,
          customerName: `QR Miza ${tableNumber || '?'}`,
          notes: `QR naročilo - Miza ${tableNumber || '?'}`,
          items: orderItems,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCart([]);
        setOrderResult(data);
        setOrderPlaced(true);
      } else {
        setOrderResult({ success: false, error: data.error || 'Napaka pri naročanju' });
        setOrderPlaced(true);
      }
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

  // FIX BUG-05 HIGH: Upoštevaj omejitve ModifierGroup (required, minSelect, maxSelect)
  function toggleModifier(mod: Modifier, mg: ModifierGroup) {
    setSelectedMods(prev => {
      const exists = prev.find(m => m.id === mod.id);
      if (exists) {
        // Deselektiranje — preveri minSelect
        const currentGroupCount = prev.filter(m => mg.modifiers.some(gm => gm.id === m.id)).length
        if (mg.required && currentGroupCount <= 1) return prev // Ne dovoli deselection če je required
        if (mg.minSelect > 0 && currentGroupCount <= mg.minSelect) return prev // Ne dovoli pod minSelect
        return prev.filter(m => m.id !== mod.id);
      }
      // Selektiranje — preveri maxSelect
      const currentGroupCount = prev.filter(m => mg.modifiers.some(gm => gm.id === m.id)).length
      if (mg.maxSelect !== null && currentGroupCount >= mg.maxSelect) {
        // Zamenjaj zadnjega iz te skupine z novim
        const groupModsInSelection = prev.filter(m => mg.modifiers.some(gm => gm.id === m.id))
        return [...prev.filter(m => !groupModsInSelection.slice(0, -1).some(gm => gm.id === m.id) || !mg.modifiers.some(gm => gm.id === m.id)), mod]
      }
      return [...prev, mod];
    });
  }

  // Preveri, da so izpolnjene vse omejitve modifikatorjev pred dodajanjem v košarico
  function validateModifierGroups(): string | null {
    if (!showItemDetail) return null
    for (const { modifierGroup: mg } of showItemDetail.modifierGroups || []) {
      const selectedInGroup = selectedMods.filter(m => mg.modifiers.some(gm => gm.id === m.id))
      if (mg.required && selectedInGroup.length === 0) {
        return `"${mg.name}" je obvezno — izberite vsaj eno možnost`
      }
      if (mg.minSelect > 0 && selectedInGroup.length < mg.minSelect) {
        return `"${mg.name}" — izberite vsaj ${mg.minSelect} možnosti`
      }
    }
    return null
  }

  // Izpeljane vrednosti
  const currentMenu = menus.find(m => m.id === activeMenu);
  const currentCategory = currentMenu?.categories.find(c => c.id === activeCategory);

  // Filter items by search
  const filteredItems = searchQuery && currentCategory
    ? currentCategory.menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentCategory?.menuItems || [];

  // Time-of-day reordered categories
  const reorderedCategories = currentMenu?.categories ? [...currentMenu.categories].sort((a, b) => {
    const aMatches = timeOfDay.promotedPrefix.some(p => a.name.startsWith(p)) ? 0 : 1;
    const bMatches = timeOfDay.promotedPrefix.some(p => b.name.startsWith(p)) ? 0 : 1;
    return aMatches - bMatches;
  }) : [];

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  // EAA: Skip to main content handler
  function skipToMain() {
    mainRef.current?.focus();
  }

  return {
    // Podatki
    menus,
    settings,
    activeMenu,
    activeCategory,
    cart,
    showCart,
    tableNumber,
    loading,
    orderPlaced,
    orderResult,
    orderSending,
    error,
    searchQuery,
    // EAA 2026: Dostopnost
    isDark,
    isHighContrast,
    fontSize,
    // Item detail modal
    showItemDetail,
    itemNotes,
    selectedMods,
    // AI Personalizacija
    upsellSuggestions,
    timeOfDay,
    upsellLoading,
    showAllergenInfo,
    // Refs
    mainRef,
    searchRef,
    cartBtnRef,
    allergenPanelRef,
    itemDetailRef,
    cartDrawerRef,
    // Izpeljane vrednosti
    currentMenu,
    currentCategory,
    filteredItems,
    reorderedCategories,
    cartItemCount,
    // Akcije
    setActiveMenu,
    setActiveCategory,
    setShowCart,
    setOrderPlaced,
    setOrderResult,
    setShowItemDetail,
    setItemNotes,
    setSearchQuery,
    setIsDark,
    setIsHighContrast,
    setFontSize,
    setShowAllergenInfo,
    addToCart,
    removeFromCart,
    updateQuantity,
    getTotal,
    getTotalWithVat,
    placeOrder,
    openItemDetail,
    toggleModifier,
    validateModifierGroups,
    skipToMain,
    setError,
  };
}

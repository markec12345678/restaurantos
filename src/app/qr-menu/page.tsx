'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// =====================================================================
// RESTAURANTOS QR MENU - World-Class 2026 Edition
// Nadgradnje:
// 1. EAA 2026 Dostopnost (WCAG 2.1 AA, high contrast, aria-labels)
// 2. Alergeni 2.0 (EU 1169/2011 — vizualno poudarjeni 14 alergenov)
// 3. AI Personalizacija (Time-of-Day, Smart Pairing Upsell z Gemini)
// =====================================================================

interface Modifier {
  id: string;
  name: string;
  price: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  modifiers: Modifier[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  vatRate: number;
  allergens: string;
  image: string;
  sortOrder: number;
  modifierGroups: { sortOrder: number; modifierGroup: ModifierGroup }[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  menuItems: MenuItem[];
}

interface Menu {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  categories: Category[];
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedModifiers: Modifier[];
  notes: string;
}

interface OrderResult {
  success: boolean;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    estimatedTime: string;
    tableNumber: string | null;
  };
  error?: string;
}

interface UpsellSuggestion {
  menuItemId: string;
  name: string;
  price: number;
  category: string;
  reason: string;
  type: 'pairing' | 'time-of-day' | 'popular';
}

// =====================================================================
// EU 1169/2011 - 14 ALERGENOV z barvnimi kodi in ikonami
// Vizualno poudarjeni skladno z EAA 2026 zahtevami
// =====================================================================
const ALLERGEN_DATA: Record<string, { label: string; labelEn: string; icon: string; color: string; highContrastColor: string }> = {
  '1':  { label: 'Žita (gluten)', labelEn: 'Cereals (gluten)', icon: '🌾', color: 'bg-amber-100 text-amber-800 border-amber-300', highContrastColor: 'bg-yellow-300 text-black border-yellow-500' },
  '2':  { label: 'Raki', labelEn: 'Crustaceans', icon: '🦐', color: 'bg-red-100 text-red-800 border-red-300', highContrastColor: 'bg-red-400 text-white border-red-600' },
  '3':  { label: 'Jajca', labelEn: 'Eggs', icon: '🥚', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', highContrastColor: 'bg-yellow-300 text-black border-yellow-500' },
  '4':  { label: 'Ribe', labelEn: 'Fish', icon: '🐟', color: 'bg-blue-100 text-blue-800 border-blue-300', highContrastColor: 'bg-blue-400 text-white border-blue-600' },
  '5':  { label: 'Arašidi', labelEn: 'Peanuts', icon: '🥜', color: 'bg-orange-100 text-orange-800 border-orange-300', highContrastColor: 'bg-orange-400 text-white border-orange-600' },
  '6':  { label: 'Soja', labelEn: 'Soybeans', icon: '🫘', color: 'bg-green-100 text-green-800 border-green-300', highContrastColor: 'bg-green-400 text-white border-green-600' },
  '7':  { label: 'Mleko', labelEn: 'Milk', icon: '🥛', color: 'bg-sky-100 text-sky-800 border-sky-300', highContrastColor: 'bg-sky-300 text-black border-sky-500' },
  '8':  { label: 'Oreški', labelEn: 'Tree nuts', icon: '🌰', color: 'bg-amber-100 text-amber-800 border-amber-300', highContrastColor: 'bg-amber-400 text-black border-amber-600' },
  '9':  { label: 'Zeler', labelEn: 'Celery', icon: '🥬', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', highContrastColor: 'bg-emerald-400 text-white border-emerald-600' },
  '10': { label: 'Gorčica', labelEn: 'Mustard', icon: '🟡', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', highContrastColor: 'bg-yellow-400 text-black border-yellow-600' },
  '11': { label: 'Sezam', labelEn: 'Sesame', icon: '⚪', color: 'bg-gray-100 text-gray-800 border-gray-300', highContrastColor: 'bg-gray-300 text-black border-gray-500' },
  '12': { label: 'SO₂ / Sulfiti', labelEn: 'Sulphites', icon: '💨', color: 'bg-purple-100 text-purple-800 border-purple-300', highContrastColor: 'bg-purple-400 text-white border-purple-600' },
  '13': { label: 'Volčji bob', labelEn: 'Lupin', icon: '🫘', color: 'bg-lime-100 text-lime-800 border-lime-300', highContrastColor: 'bg-lime-400 text-black border-lime-600' },
  '14': { label: 'Mehkužci', labelEn: 'Molluscs', icon: '🐚', color: 'bg-teal-100 text-teal-800 border-teal-300', highContrastColor: 'bg-teal-400 text-white border-teal-600' },
};

const VAT_LABELS: Record<number, string> = {
  22: 'DDV 22%',
  9.5: 'DDV 9,5%',
  0: 'brez DDV',
};

// =====================================================================
// TIME-OF-DAY logika
// =====================================================================
function getTimeOfDay(hour: number): { key: string; label: string; icon: string; promotedPrefix: string[] } {
  if (hour >= 6 && hour < 11) return { key: 'morning', label: 'Zajtrk', icon: '🌅', promotedPrefix: ['Zajtrk', 'Kava', 'Vroče', 'Sadni'] };
  if (hour >= 11 && hour < 14) return { key: 'lunch', label: 'Kosilo', icon: '☀️', promotedPrefix: ['Juhe', 'Testenine', 'Dnevna', 'Rižote'] };
  if (hour >= 14 && hour < 17) return { key: 'afternoon', label: 'Popoldne', icon: '☕', promotedPrefix: ['Kava', 'Sladice', 'Koktajli', 'Deserti'] };
  if (hour >= 17 && hour < 22) return { key: 'evening', label: 'Večerja', icon: '🌙', promotedPrefix: ['Predjedi', 'Glavne', 'Jedi z žara', 'Steak', 'Vino'] };
  return { key: 'night', label: 'Pozna večerja', icon: '🌃', promotedPrefix: ['Burgerji', 'Koktajli', 'Pivo', 'Prigrizki'] };
}

export default function QRMenuPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [tableNumber, setTableNumber] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [orderSending, setOrderSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ===== EAA 2026: Dostopnost =====
  const [isDark, setIsDark] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xl'>('normal');

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
    const savedFontSize = localStorage.getItem('qr-font-size') as 'normal' | 'large' | 'xl' | null;
    if (savedFontSize) setFontSize(savedFontSize);

    // PWA install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
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
  }, [cart.length]);

  async function fetchMenu() {
    try {
      const res = await fetch('/api/public/menu');
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
    } catch (e) {
      console.error('Error loading menu:', e);
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
    } catch (e) {
      console.log('Upsell suggestions not available');
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
    } catch (e) {
      console.error('Error placing order:', e);
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

  function toggleModifier(mod: Modifier) {
    setSelectedMods(prev => {
      const exists = prev.find(m => m.id === mod.id);
      if (exists) return prev.filter(m => m.id !== mod.id);
      return [...prev, mod];
    });
  }

  // Font size class
  const fontClass = fontSize === 'xl' ? 'text-lg' : fontSize === 'large' ? 'text-base' : 'text-sm';
  const headingClass = fontSize === 'xl' ? 'text-2xl' : fontSize === 'large' ? 'text-xl' : 'text-lg';
  const priceClass = fontSize === 'xl' ? 'text-2xl' : fontSize === 'large' ? 'text-xl' : 'text-lg';

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

  // ==================== LOADING SCREEN ====================
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100'}`} role="alert" aria-live="polite" aria-label="Nalaganje menija">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-amber-200 dark:border-gray-700"></div>
            <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
            <div className="absolute inset-3 rounded-full bg-amber-500 flex items-center justify-center text-white text-2xl" aria-hidden="true">🍽</div>
          </div>
          <p className={`text-lg font-semibold ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>Nalagam meni...</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-amber-600'}`}>Pripravljam digitalni jedilnik</p>
        </div>
      </div>
    );
  }

  // ==================== ORDER CONFIRMED SCREEN ====================
  if (orderPlaced && orderResult?.success) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-green-50 to-emerald-100'}`} role="alert" aria-live="polite">
        <div className={`text-center ${isDark ? 'bg-gray-900' : 'bg-white/80'} backdrop-blur-xl rounded-3xl shadow-2xl p-8 mx-4 max-w-md border ${isDark ? 'border-gray-800' : 'border-white/50'}`}>
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30" aria-hidden="true">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}>Naročilo sprejeto!</h2>
          <p className={`mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Vaše naročilo je v obdelavi</p>
          {orderResult.order && (
            <>
              <p className="text-amber-600 font-mono text-lg font-bold mt-3" aria-label={`Številka naročila: ${orderResult.order.orderNumber}`}>#{orderResult.order.orderNumber}</p>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Predviden čas: ~{orderResult.order.estimatedTime}
              </p>
            </>
          )}
          <button
            onClick={() => { setOrderPlaced(false); setOrderResult(null); }}
            className="mt-6 bg-amber-500 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-amber-600 active:scale-95 transition shadow-lg shadow-amber-500/30"
            aria-label="Naroči še kaj"
          >
            Naroči še kaj
          </button>
        </div>
      </div>
    );
  }

  // ==================== ORDER ERROR SCREEN ====================
  if (orderPlaced && orderResult && !orderResult.success) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-red-50 to-orange-100'}`} role="alert" aria-live="assertive">
        <div className={`text-center ${isDark ? 'bg-gray-900' : 'bg-white/80'} backdrop-blur-xl rounded-3xl shadow-2xl p-8 mx-4 max-w-md border ${isDark ? 'border-gray-800' : 'border-white/50'}`}>
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/30" aria-hidden="true">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>Napaka</h2>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{orderResult.error}</p>
          <button
            onClick={() => { setOrderPlaced(false); setOrderResult(null); }}
            className="mt-6 bg-amber-500 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-amber-600 active:scale-95 transition"
            aria-label="Poskusi znova"
          >
            Poskusi znova
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN QR MENU ====================
  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950 text-gray-100' : isHighContrast ? 'bg-white text-black' : 'bg-gradient-to-b from-amber-50 via-orange-50/50 to-amber-100/80 text-gray-900'} ${fontSize === 'xl' ? 'text-lg' : fontSize === 'large' ? 'text-base' : ''}`}>

      {/* ===== EAA: Skip to main content (WCAG 2.4.1) ===== */}
      <a href="#main-content"
        onClick={(e) => { e.preventDefault(); skipToMain(); }}
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
                onClick={() => {
                  const sizes: Array<'normal' | 'large' | 'xl'> = ['normal', 'large', 'xl'];
                  const idx = sizes.indexOf(fontSize);
                  const next = sizes[(idx + 1) % sizes.length];
                  setFontSize(next);
                  localStorage.setItem('qr-font-size', next);
                }}
                className={`p-2 rounded-xl ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-amber-100 text-amber-700'} transition active:scale-90`}
                aria-label={`Velikost pisave: ${fontSize === 'normal' ? 'Normalna' : fontSize === 'large' ? 'Velika' : 'Največja'}. Kliknite za povečavo.`}
                title="Velikost pisave"
              >
                <span className="text-sm font-bold" aria-hidden="true">Aa</span>
              </button>
              {/* High contrast toggle - EAA 1.4.3 Contrast */}
              <button
                onClick={() => setIsHighContrast(!isHighContrast)}
                className={`p-2 rounded-xl ${isHighContrast ? 'bg-black text-yellow-300 border-2 border-yellow-400' : isDark ? 'bg-gray-800 text-gray-400' : 'bg-amber-100 text-amber-700'} transition active:scale-90`}
                aria-label={`${isHighContrast ? 'Izklopi' : 'Vklopi'} visok kontrast`}
                title="Visok kontrast (EAA)"
              >
                <span className="text-sm" aria-hidden="true">🌓</span>
              </button>
              {/* Dark mode toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                className={`p-2 rounded-xl ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-amber-100 text-amber-700'} transition active:scale-90`}
                aria-label={`${isDark ? 'Svetli' : 'Temni'} način`}
                title="Temni/svetli način"
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              {/* Allergen info button - EU 1169/2011 */}
              <button
                onClick={() => setShowAllergenInfo(!showAllergenInfo)}
                className={`p-2 rounded-xl ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-orange-100 text-orange-700'} transition active:scale-90`}
                aria-label="Informacije o alergenih"
                title="Alergeni (EU 1169/2011)"
              >
                <span className="text-sm" aria-hidden="true">⚠️</span>
              </button>
              {/* Cart button */}
              <button
                ref={cartBtnRef}
                onClick={() => setShowCart(!showCart)}
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
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Išči po meniju..."
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500' : isHighContrast ? 'bg-white border-2 border-black text-black placeholder:text-gray-700' : 'bg-white/60 border-amber-200 text-gray-900 placeholder:text-amber-400'} border backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50`}
              aria-label="Iskanje po meniju"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Počisti iskanje">✕</button>
            )}
          </div>
        </div>
      </header>

      {/* ===== ALLERGEN INFO PANEL - EU 1169/2011 ===== */}
      {showAllergenInfo && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Informacije o alergenih">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAllergenInfo(false)} />
          <div className={`absolute bottom-0 left-0 right-0 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl shadow-2xl max-h-[80vh] overflow-auto`}>
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold">Alergeni (EU 1169/2011)</h2>
              <button onClick={() => setShowAllergenInfo(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Zapri">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                V skladu z Uredbo EU 1169/2011 smo dolžni obvestiti o prisotnosti 14 alergenov. Alergeni so označeni pri vsaki jedi.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ALLERGEN_DATA).map(([num, data]) => (
                  <div key={num} className={`flex items-center gap-2 p-2 rounded-xl border ${isHighContrast ? data.highContrastColor : data.color}`}>
                    <span className="text-lg" aria-hidden="true">{data.icon}</span>
                    <div>
                      <p className="font-bold text-xs">{data.label}</p>
                      <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{data.labelEn}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Obvestite osebje o morebitnih alergijah ali intolerancah pred naročilom.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== MENU TABS (Hrana / Pijača) ===== */}
      <nav className="max-w-lg mx-auto px-4 pt-3" aria-label="Izbira menija">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="tablist">
          {menus.map(menu => (
            <button
              key={menu.id}
              role="tab"
              aria-selected={activeMenu === menu.id}
              aria-controls={`panel-${menu.id}`}
              onClick={() => {
                setActiveMenu(menu.id);
                const matchingCat = menu.categories?.find((c: Category) =>
                  timeOfDay.promotedPrefix.some(p => c.name.startsWith(p))
                );
                setActiveCategory(matchingCat?.id || menu.categories?.[0]?.id || '');
              }}
              className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                activeMenu === menu.id
                  ? `${isDark ? 'bg-amber-500 text-gray-900 shadow-lg shadow-amber-500/30' : 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'}`
                  : `${isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white/70 text-amber-700 hover:bg-white shadow-sm'}`
              }`}
            >
              {menu.icon} {menu.name}
            </button>
          ))}
        </div>
      </nav>

      {/* ===== CATEGORY TABS (Time-of-Day reordered) ===== */}
      {currentMenu && (
        <nav className="max-w-lg mx-auto px-4 pb-2" aria-label="Kategorije menija">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="tablist">
            {reorderedCategories.map(cat => {
              const isPromoted = timeOfDay.promotedPrefix.some(p => cat.name.startsWith(p));
              return (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    activeCategory === cat.id
                      ? `${isDark ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : isHighContrast ? 'bg-black text-white border-2 border-black' : 'bg-amber-100 text-amber-800 border border-amber-300 shadow-sm'}`
                      : `${isDark ? 'bg-gray-800/50 text-gray-500 border border-transparent hover:bg-gray-800' : 'bg-white/40 text-gray-500 border border-transparent hover:bg-white/80'}`
                  } ${isPromoted && activeCategory !== cat.id ? 'ring-1 ring-amber-400/50' : ''}`}
                >
                  {cat.icon} {cat.name}
                  <span className={`ml-1 text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    ({cat.menuItems.length})
                  </span>
                  {isPromoted && <span className="ml-1 text-[9px]" aria-label="Priporočeno za ta čas">✨</span>}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <main id="main-content" ref={mainRef} tabIndex={-1} className="max-w-lg mx-auto px-4 pb-28 space-y-3 outline-none" role="tabpanel" aria-label={`Jedi v kategoriji ${currentCategory?.name || ''}`}>
        {filteredItems.map(item => {
          const allergenNums = item.allergens ? item.allergens.split(',').filter(Boolean) : [];
          const inCart = cart
            .filter(c => c.menuItem.id === item.id)
            .reduce((s, c) => s + c.quantity, 0);

          return (
            <article
              key={item.id}
              className={`${isDark ? 'bg-gray-900/80 border-gray-800' : isHighContrast ? 'bg-white border-2 border-black' : 'bg-white/70 border-white/50'} backdrop-blur-xl rounded-2xl border shadow-sm flex active:scale-[0.98] transition-all duration-150 cursor-pointer hover:shadow-md overflow-hidden`}
              onClick={() => openItemDetail(item)}
              role="button"
              tabIndex={0}
              aria-label={`${item.name}, €${(item.price * (1 + item.vatRate / 100)).toFixed(2)} z DDV${allergenNums.length > 0 ? `. Alergeni: ${allergenNums.map(a => ALLERGEN_DATA[a.trim()]?.label || a).join(', ')}` : ''}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItemDetail(item); } }}
            >
              {/* ===== ITEM IMAGE ===== */}
              {item.image ? (
                <div className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 relative">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className={`flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-amber-50'}`}>
                  <span className="text-3xl" aria-hidden="true">🍽</span>
                </div>
              )}
              <div className="flex-1 min-w-0 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-bold ${fontSize === 'xl' ? 'text-lg' : 'text-base'} leading-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    {item.name}
                  </h3>
                  {inCart > 0 && (
                    <span className="flex-shrink-0 bg-amber-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" aria-label={`${inCart}x v košarici`}>
                      {inCart}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className={`text-sm mt-0.5 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {item.description}
                  </p>
                )}
                {/* ===== ALLERGENI 2.0: Vizualno poudarjeni (EU 1169/2011) ===== */}
                {allergenNums.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5" role="list" aria-label="Alergeni">
                    {allergenNums.map(a => {
                      const aData = ALLERGEN_DATA[a.trim()];
                      if (!aData) return null;
                      return (
                        <span key={a} role="listitem"
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${isHighContrast ? aData.highContrastColor : aData.color}`}
                          aria-label={aData.label}
                        >
                          {aData.icon} {aData.label}
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* Quick add + price */}
                <div className="flex items-end justify-between gap-2 mt-2">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-bold ${fontSize === 'xl' ? 'text-2xl' : fontSize === 'large' ? 'text-xl' : 'text-lg'} ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                      €{(item.price * (1 + item.vatRate / 100)).toFixed(2)}
                    </span>
                    <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {VAT_LABELS[item.vatRate] || `${item.vatRate}%`}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    className={`${isDark ? 'bg-amber-500 hover:bg-amber-400' : 'bg-amber-500 hover:bg-amber-600'} text-white rounded-xl p-2.5 shadow-md shadow-amber-500/20 active:scale-90 transition-all`}
                    aria-label={`Dodaj ${item.name} v košarico`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12" role="status">
            <p className="text-4xl mb-2" aria-hidden="true">🔍</p>
            <p className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {searchQuery ? `Ni rezultatov za "${searchQuery}"` : 'Kategorija je prazna'}
            </p>
          </div>
        )}
      </main>

      {/* ===== AI SMART PAIRING UPSELL SUGGESTIONS ===== */}
      {upsellSuggestions.length > 0 && !showCart && cartItemCount > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-20 max-w-lg mx-auto" role="complementary" aria-label="Predlogi za dopolnitev naročila">
          <div className={`${isDark ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-amber-200'} backdrop-blur-xl rounded-2xl border shadow-xl p-3`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm" aria-hidden="true">🤖</span>
              <p className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Priporočamo</p>
              {upsellLoading && <svg className="animate-spin w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {upsellSuggestions.slice(0, 3).map((sug, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const found = currentMenu?.categories.flatMap(c => c.menuItems).find(i => i.id === sug.menuItemId);
                    if (found) addToCart(found);
                  }}
                  className={`flex-shrink-0 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-amber-50 hover:bg-amber-100'} rounded-xl p-2.5 text-left transition min-w-[160px]`}
                  aria-label={`${sug.name} €${(sug.price * 1.22).toFixed(2)}. ${sug.reason}`}
                >
                  <p className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{sug.name}</p>
                  <p className={`text-[10px] mt-0.5 line-clamp-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{sug.reason}</p>
                  <p className={`text-xs font-bold mt-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>+€{(sug.price * 1.22).toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== ITEM DETAIL MODAL ===== */}
      {showItemDetail && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Podrobnosti: ${showItemDetail.name}`}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowItemDetail(null)} />
          <div className={`absolute bottom-0 left-0 right-0 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl shadow-2xl max-h-[85vh] overflow-auto`}>
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold truncate pr-4">{showItemDetail.name}</h2>
              <button onClick={() => setShowItemDetail(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Zapri podrobnosti">&times;</button>
            </div>

            <div className="p-4 space-y-4">
              {/* ===== ITEM IMAGE ===== */}
              {showItemDetail.image && (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden">
                  <img
                    src={showItemDetail.image}
                    alt={showItemDetail.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
              )}
              {showItemDetail.description && (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{showItemDetail.description}</p>
              )}

              {/* ===== ALLERGENI 2.0: Podrobni prikaz z barvnimi kodi ===== */}
              {showItemDetail.allergens && (
                <div>
                  <p className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    ALERGENI (EU 1169/2011)
                  </p>
                  <div className="flex flex-wrap gap-1.5" role="list" aria-label="Seznam alergenov">
                    {showItemDetail.allergens.split(',').filter(Boolean).map(a => {
                      const aData = ALLERGEN_DATA[a.trim()];
                      if (!aData) return null;
                      return (
                        <span key={a} role="listitem"
                          className={`text-xs px-2 py-1 rounded-lg border font-bold flex items-center gap-1 ${isHighContrast ? aData.highContrastColor : aData.color}`}
                        >
                          <span aria-hidden="true">{aData.icon}</span>
                          {aData.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modifier Groups */}
              {showItemDetail.modifierGroups?.map(({ modifierGroup: mg }) => (
                <div key={mg.id}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{mg.name}</p>
                    {mg.required && <span className="text-xs text-red-500 font-bold">*obvezno</span>}
                  </div>
                  <div className="space-y-1.5" role="group" aria-label={mg.name}>
                    {mg.modifiers.map(mod => {
                      const isSelected = selectedMods.find(m => m.id === mod.id);
                      return (
                        <button
                          key={mod.id}
                          onClick={() => toggleModifier(mod)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm transition ${
                            isSelected
                              ? `${isDark ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-amber-100 border-amber-300 text-amber-800'} border`
                              : `${isDark ? 'bg-gray-800/50 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'} border`
                          }`}
                          role="checkbox"
                          aria-checked={!!isSelected}
                          aria-label={`${mod.name}${mod.price > 0 ? ` +€${mod.price.toFixed(2)}` : ''}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                              isSelected ? 'bg-amber-500 border-amber-500' : `${isDark ? 'border-gray-600' : 'border-gray-300'}`
                            }`}>
                              {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </span>
                            {mod.name}
                          </span>
                          {mod.price > 0 && <span className={`text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>+€{mod.price.toFixed(2)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Notes */}
              <div>
                <label htmlFor="item-notes" className={`text-xs font-semibold mb-1 block ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>OPOMBE</label>
                <textarea
                  id="item-notes"
                  value={itemNotes}
                  onChange={e => setItemNotes(e.target.value)}
                  placeholder="Npr. brez česna, alergija na..."
                  rows={2}
                  className={`w-full p-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'} border focus:outline-none focus:ring-2 focus:ring-amber-500/50`}
                />
              </div>

              {/* Add to cart button */}
              <button
                onClick={() => addToCart(showItemDetail, selectedMods, itemNotes)}
                className={`w-full ${isDark ? 'bg-amber-500 hover:bg-amber-400 text-gray-900' : 'bg-amber-500 hover:bg-amber-600 text-white'} py-4 rounded-2xl font-bold text-lg active:scale-[0.98] transition shadow-lg shadow-amber-500/30`}
                aria-label={`Dodaj v košarico. Skupaj €${((showItemDetail.price + selectedMods.reduce((s, m) => s + m.price, 0)) * (1 + showItemDetail.vatRate / 100)).toFixed(2)} z DDV`}
              >
                Dodaj v košarico · €{((showItemDetail.price + selectedMods.reduce((s, m) => s + m.price, 0)) * (1 + showItemDetail.vatRate / 100)).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CART DRAWER - Bottom sheet ===== */}
      {showCart && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Vaše naročilo">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className={`absolute bottom-0 left-0 right-0 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col`}>
            {/* Cart header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold" id="cart-title">Vaše naročilo</h2>
                {cartItemCount > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5" aria-label={`${cartItemCount} izdelkov`}>{cartItemCount}</span>
                )}
              </div>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Zapri košarico">&times;</button>
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
                            onClick={() => updateQuantity(index, -1)}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition ${
                              isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                            aria-label={`Zmanjšaj količino ${item.menuItem.name}`}
                          >
                            −
                          </button>
                          <span className={`w-6 text-center font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`} aria-label={`Količina: ${item.quantity}`}>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(index, 1)}
                            className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm font-bold hover:bg-amber-600 transition"
                            aria-label={`Povečaj količino ${item.menuItem.name}`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(index)}
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
                            if (found) addToCart(found);
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
                      <span>€{getTotal().toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <span>DDV</span>
                      <span>€{(getTotalWithVat() - getTotal()).toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between text-lg font-bold pt-1 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                      <span>Skupaj z DDV</span>
                      <span>€{getTotalWithVat().toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={placeOrder}
                    disabled={orderSending}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition shadow-lg active:scale-[0.98] ${
                      orderSending
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed shadow-none'
                        : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/30'
                    }`}
                    aria-label={`Naroči za €${getTotalWithVat().toFixed(2)}`}
                  >
                    {orderSending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Pošiljam...
                      </span>
                    ) : (
                      `Naroči · €${getTotalWithVat().toFixed(2)}`
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== FLOATING CART BAR (when items in cart, cart drawer closed) ===== */}
      {!showCart && cartItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30 max-w-lg mx-auto">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-amber-500 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-2xl shadow-amber-500/40 flex items-center justify-between active:scale-[0.98] transition hover:bg-amber-600"
            aria-label={`Poglej košarico, ${cartItemCount} izdelkov, skupaj €${getTotalWithVat().toFixed(2)}`}
          >
            <span className="flex items-center gap-2">
              <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm font-bold">{cartItemCount}</span>
              Poglej košarico
            </span>
            <span>€{getTotalWithVat().toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// QR Ordering - Main hook za stanje in logiko
// =====================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { translations } from '../../translations';
import type { Locale } from '../../translations';
import type { CartItem, MenuType, MenuItemType, OrderResult, RestaurantInfo } from '../../types';
import type { QROrderingState } from './types';
import {
  addItemToCart,
  addItemToCartWithNote,
  updateCartItemQuantity,
  removeCartItem,
  calculateCartCount,
  calculateCartTotal,
  calculateCartTax,
} from './cart-utils';
import { submitOrderRequest, callWaiterRequest } from './order-actions';
import { computeDerivedValues, getSuperGroupForCategoryName } from './derived';

export type { QROrderingState } from './types';

export function useQROrdering(params: Promise<{ tableId: string }>): QROrderingState {
  // State
  const [tableId, setTableId] = useState<string>('');
  const [locale, setLocale] = useState<Locale>('sl');
  const [menus, setMenus] = useState<MenuType[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string>('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('');
  const [localeOpen, setLocaleOpen] = useState(false);
  const [tableNotFound, setTableNotFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailItem, setDetailItem] = useState<MenuItemType | null>(null);
  const [detailNote, setDetailNote] = useState('');
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [waiterCooldown, setWaiterCooldown] = useState(false);
  const [activeSuperGroup, setActiveSuperGroup] = useState<string>('all');

  const t = translations[locale];
  const statusRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve params
  useEffect(() => {
    params.then(p => setTableId(p.tableId));
  }, [params]);

  // Fetch menu data + verify table
  useEffect(() => {
    if (!tableId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/public/menu');
        if (!res.ok) throw new Error('Failed to fetch menu');
        const data = await res.json();
        if (data.menus && data.menus.length > 0) {
          setMenus(data.menus);
          setActiveMenuId(data.menus[0].id);
          if (data.menus[0].categories?.length > 0) {
            setActiveCategoryId(data.menus[0].categories[0].id);
          }
        }
        setRestaurant(data.restaurant);
        setError(null);
      } catch {
        setError('Napaka pri nalaganju.');
      } finally {
        setLoading(false);
      }
    };
    const verifyTable = async () => {
      try {
        const res = await fetch(`/api/public/verify-table?tableId=${encodeURIComponent(tableId)}`);
        if (res.ok) {
          const data = await res.json();
          if (!data.exists) setTableNotFound(true);
        }
      } catch { /* Can't verify - let user proceed */ }
    };
    fetchData();
    verifyTable();
  }, [tableId]);

  // Poll order status after order placed
  useEffect(() => {
    if (!orderResult) return;
    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/public/order-track?orderId=${orderResult.orderId}`);
        if (res.ok) { const order = await res.json(); setOrderStatus(order.status); }
      } catch { /* Silent */ }
    };
    pollStatus();
    statusRef.current = setInterval(pollStatus, 10000);
    return () => { if (statusRef.current) clearInterval(statusRef.current); };
  }, [orderResult]);

  // Cart handlers
  const addToCartHandler = useCallback((item: MenuItemType) => {
    setCart(prev => addItemToCart(prev, item));
  }, []);

  const addToCartWithNoteHandler = useCallback((item: MenuItemType, note: string) => {
    setCart(prev => addItemToCartWithNote(prev, item, note));
  }, []);

  const updateQuantityHandler = useCallback((menuItemId: string, notes: string, delta: number) => {
    setCart(prev => updateCartItemQuantity(prev, menuItemId, notes, delta));
  }, []);

  const removeItemHandler = useCallback((menuItemId: string, notes: string) => {
    setCart(prev => removeCartItem(prev, menuItemId, notes));
  }, []);

  const cartCount = calculateCartCount(cart);
  const cartTotal = calculateCartTotal(cart);
  const cartTax = calculateCartTax(cart);

  // Call waiter
  const callWaiter = useCallback(async () => {
    if (waiterCooldown) return;
    const ok = await callWaiterRequest(tableId);
    if (ok) {
      setWaiterCalled(true);
      setWaiterCooldown(true);
      setTimeout(() => setWaiterCalled(false), 3000);
      setTimeout(() => setWaiterCooldown(false), 30000);
    }
  }, [tableId, waiterCooldown]);

  // Submit order
  const submitOrder = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitOrderRequest({ tableId, customerName, customerPhone, orderNotes, cart });
      setOrderResult({ orderNumber: result.orderNumber, orderId: result.orderId, tableNumber: result.tableNumber });
      setOrderStatus(result.status);
      setCart([]);
      setCartOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Napaka pri naročanju');
    } finally {
      setSubmitting(false);
    }
  };

  // Derived values
  const getSuperGroupForCategory = useCallback((catName: string): string | null => {
    return getSuperGroupForCategoryName(catName);
  }, []);

  const derived = computeDerivedValues({ menus, activeMenuId, activeCategoryId, activeSuperGroup, searchQuery });

  const dismissOrderResult = () => { setOrderResult(null); setOrderStatus(''); };

  return {
    tableId, locale, setLocale, menus, restaurant,
    activeMenuId, setActiveMenuId, activeCategoryId, setActiveCategoryId,
    cart, cartOpen, setCartOpen,
    customerName, setCustomerName, customerPhone, setCustomerPhone,
    orderNotes, setOrderNotes,
    loading, submitting, error, setError,
    orderResult, orderStatus, localeOpen, setLocaleOpen, tableNotFound,
    searchQuery, setSearchQuery, detailItem, setDetailItem, detailNote, setDetailNote,
    waiterCalled, waiterCooldown, activeSuperGroup, setActiveSuperGroup,
    t, cartCount, cartTotal, cartTax,
    ...derived,
    addToCart: addToCartHandler,
    addToCartWithNote: addToCartWithNoteHandler,
    updateQuantity: updateQuantityHandler,
    removeItem: removeItemHandler,
    callWaiter, submitOrder, getSuperGroupForCategory, dismissOrderResult,
  };
}

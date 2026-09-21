// =====================================================================
// QR Ordering - Effects (fetch, verify, poll)
// =====================================================================

import { useEffect, useRef } from 'react';
import type { MenuType, OrderResult, RestaurantInfo } from '../../types';

export interface UseQREffectsParams {
  params: Promise<{ tableId: string }>;
  tableId: string;
  setTableId: (_id: string) => void;
  setMenus: (_menus: MenuType[]) => void;
  setRestaurant: (_info: RestaurantInfo | null) => void;
  setActiveMenuId: (_id: string) => void;
  setActiveCategoryId: (_id: string) => void;
  setLoading: (_loading: boolean) => void;
  setError: (_error: string | null) => void;
  setTableNotFound: (_notFound: boolean) => void;
  orderResult: OrderResult | null;
  setOrderStatus: (_status: string) => void;
}

export function useQREffects({
  params,
  tableId,
  setTableId,
  setMenus,
  setRestaurant,
  setActiveMenuId,
  setActiveCategoryId,
  setLoading,
  setError,
  setTableNotFound,
  orderResult,
  setOrderStatus,
}: UseQREffectsParams) {
  const statusRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve params
  useEffect(() => {
    params.then(p => setTableId(p.tableId));
  }, [params, setTableId]);

  // Fetch menu data + verify table
  // R90: en sam SEKVENCEN tok — verify-table NAJPREJ (uspešen odgovor nosi
  // locationId, kontrakt R90-1), nato menu fetch z ?locationId= (od R90-1
  // obvezen: brez njega strežnik vrne unificiran 404 — konec globalnega
  // fallback menija poljubne lokacije).
  useEffect(() => {
    if (!tableId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        // R90: verify-table razreši lokacijski kontekst za menu zahtevek.
        let locationId: string | null = null;
        try {
          const vres = await fetch(`/api/public/verify-table?tableId=${encodeURIComponent(tableId)}`);
          if (vres.ok) {
            const vdata = await vres.json();
            if (!vdata.exists) {
              // Miza ne obstaja → isti UX kot doslej: not-found UI, menu
              // fetch se izpusti (loading pade v finally).
              setTableNotFound(true);
              return;
            }
            locationId = typeof vdata.locationId === 'string' && vdata.locationId ? vdata.locationId : null;
          }
        } catch {
          /* Can't verify - let user proceed */
          // R90: brez verify konteksta poskušamo menu VSEENO, brez ?locationId
          // → strežnik (R90-1) vrne unificiran 404 → spodnji catch postavi
          // 'Napaka pri nalaganju.' To je pravilen fail-closed degraded
          // state (prej bi sicer padel na globalni fallback meni).
        }
        const qs = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
        const res = await fetch(`/api/public/menu${qs}`);
        if (!res.ok) throw new Error('Failed to fetch menu');
        const data = await res.json();
        if (data.menus && data.menus.length > 0) {
          setMenus(data.menus);
          setActiveMenuId(data.menus[0].id);
          if (data.menus[0].categories?.length > 0) {
            setActiveCategoryId(data.menus[0].categories[0].id);
          }
        }
        // Pre-existing quirk (R90, namenoma ohranjen): endpoint vrača
        // `settings`, ne `restaurant` — vrstica ostane, obnašanje identično.
        setRestaurant(data.restaurant);
        setError(null);
      } catch {
        setError('Napaka pri nalaganju.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tableId, setMenus, setRestaurant, setActiveMenuId, setActiveCategoryId, setLoading, setError, setTableNotFound]);

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
  }, [orderResult, setOrderStatus]);

  return { statusRef };
}

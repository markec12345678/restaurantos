// =====================================================================
// QR Ordering - Order & waiter action helpers
// =====================================================================

import type { CartItem } from '../../types';

export interface SubmitOrderParams {
  tableId: string;
  customerName: string;
  customerPhone: string;
  orderNotes: string;
  cart: CartItem[];
}

/** R124 (P0-03): naročilo zavrnjeno zaradi izprodanih artiklov (409/400 unavailableItems) */
export class SoldOutError extends Error {
  constructor() {
    super('SOLD_OUT')
    this.name = 'SoldOutError'
  }
}

/** Build order request payload and send to API */
export async function submitOrderRequest(
  params: SubmitOrderParams,
): Promise<{ orderNumber: number; orderId: string; tableNumber: number; status: string }> {
  const { tableId, customerName, customerPhone, orderNotes, cart } = params;

  const res = await fetch('/api/public/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tableId,
      customerName,
      customerPhone,
      orderItems: cart.map(c => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        notes: c.notes,
        modifiersJson: '[]',
      })),
      notes: orderNotes,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    // R124 (P0-03): 409 (INSUFFICIENT_STOCK) ali 400 z unavailableItems —
    // jasno sporočilo v UI (kanon: strežnik je avtoriteten).
    const soldOut = res.status === 409
      || Array.isArray(data.unavailableItems)
      || /zaloge|izprodan/i.test(String(data.error || ''))
    if (soldOut) throw new SoldOutError()
    throw new Error(data.error || 'Napaka');
  }

  return {
    orderNumber: data.order.orderNumber,
    orderId: data.order.id,
    tableNumber: data.order.tableNumber,
    status: data.order.status,
  };
}

/** Call waiter API call, returns true if successful */
export async function callWaiterRequest(tableId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/public/call-waiter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, message: '' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

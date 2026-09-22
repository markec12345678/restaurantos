// ============================================
// WS QUERY INVALIDATION — preslikava event → skupine (runda 28)
//
// BUG FIX TEST (najpomembnejši): strežnik pošilja 'ITEM_STATUS_UPDATE'
// (handle-item-status.ts broadcastWS) in 'order_ready' (lowercase,
// wsBroadcastEvent). Stari switch je poslušal 'ITEM_STATUS_CHANGED' in
// 'ORDER_READY' — KDS/natakar WS refetch nikoli ne streže (samo polling).
// Te testi ZAKLENJEJO pravilna imena.
// ============================================

import { describe, it, expect } from 'vitest'
import { invalidationGroupsForEvent } from '@/lib/websocket-client/use-query-invalidation'

describe('invalidationGroupsForEvent', () => {
  it('ITEM_STATUS_UPDATE (veljavno ime strežnika) → kitchen + orders', () => {
    const groups = invalidationGroupsForEvent('ITEM_STATUS_UPDATE')
    expect(groups).toContain('kitchen')
    expect(groups).toContain('orders')
  })

  it('order_ready (lowercase, kot pošilja strežnik) → orders + waiter + kitchen + dashboard', () => {
    const groups = invalidationGroupsForEvent('order_ready')
    expect(groups).toContain('orders')
    expect(groups).toContain('ordersWaiter')
    expect(groups).toContain('kitchen')
    expect(groups).toContain('dashboard')
  })

  it('ORDER_READY (uppercase union alias) ima ISTI set kot order_ready', () => {
    expect(invalidationGroupsForEvent('ORDER_READY')).toEqual(
      invalidationGroupsForEvent('order_ready')
    )
  })

  it('ITEM_STATUS_CHANGED (legacy alias) → kitchen + orders', () => {
    const groups = invalidationGroupsForEvent('ITEM_STATUS_CHANGED')
    expect(groups).toContain('kitchen')
    expect(groups).toContain('orders')
  })

  it('NEW_ORDER → vključno s sidebar', () => {
    const groups = invalidationGroupsForEvent('NEW_ORDER')
    expect(groups).toContain('ordersSidebar')
    expect(groups).toContain('kitchen')
    expect(groups).toContain('dashboard')
  })

  it('ORDER_FIRED → orders + kitchen + dashboard', () => {
    const groups = invalidationGroupsForEvent('ORDER_FIRED')
    expect(groups).toEqual(['orders', 'kitchen', 'dashboard'])
  })

  it('STOCK_LOW/STOCK_OUT → zaloga + lowStock + dashboard', () => {
    for (const ev of ['STOCK_LOW', 'STOCK_OUT']) {
      const groups = invalidationGroupsForEvent(ev)
      expect(groups).toContain('inventory')
      expect(groups).toContain('inventoryLowStock')
      expect(groups).toContain('dashboard')
    }
  })

  it('neznan dogodek → prazna množica (no-op)', () => {
    expect(invalidationGroupsForEvent('UNKNOWN_EVENT')).toEqual([])
    expect(invalidationGroupsForEvent('')).toEqual([])
  })
})

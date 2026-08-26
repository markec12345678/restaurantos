// ============================================
// QUERY KEYS — Dostava, Lokacije, Dobavitelji, HACCP, FURS, Računi, Ostalo
// ============================================

export const deliveryKeys = {
  tracking: ['delivery-trackings'] as const,
  onlineOrders: ['online-orders-admin'] as const,
  zones: ['delivery-zones'] as const,
  unassigned: ['unassigned-deliveries'] as const,
}

export const locationsKeys = {
  all: ['locations'] as const,
  stats: ['location-stats'] as const,
}

export const suppliersKeys = {
  all: ['suppliers'] as const,
}

export const purchaseOrdersKeys = {
  all: ['purchase-orders'] as const,
}

export const haccpKeys = {
  all: ['haccp'] as const,
}

export const fursKeys = {
  settings: ['furs-settings'] as const,
  status: ['furs-status'] as const,
  batchStatus: ['furs-batch-status'] as const,
}

export const receiptKeys = {
  all: ['receipt'] as const,
  byOrder: (orderId: string) => ['receipt', orderId] as const,
}

export const zReportKeys = {
  all: ['z-reports'] as const,
  current: ['z-report'] as const,
}

export const authKeys = {
  status: ['auth-status'] as const,
}

export const webhooksKeys = {
  all: ['webhooks'] as const,
}

export const integrationsKeys = {
  all: ['integrations'] as const,
}

export const expensesKeys = {
  all: ['expenses'] as const,
}

export const feedbackKeys = {
  all: ['feedback'] as const,
}

export const dailyChecklistKeys = {
  all: ['daily-checklist'] as const,
}

export const discountsKeys = {
  all: ['discounts'] as const,
  active: ['discounts-active'] as const,
}

export const diningOptionsKeys = {
  all: ['dining-options'] as const,
}

export const voidReasonsKeys = {
  all: ['void-reasons'] as const,
}

export const recipesKeys = {
  all: ['recipes'] as const,
}

export const subscriptionKeys = {
  all: ['subscription'] as const,
}

export const waitlistKeys = {
  all: ['waitlist'] as const,
}

export const notificationsKeys = {
  all: ['notifications'] as const,
  orders: ['notification-orders'] as const,
}

export const menuEngineeringKeys = {
  all: ['menu-engineering'] as const,
}

export const menuItemNutritionKeys = {
  all: ['menu-items-nutrition'] as const,
}

export const recentOrders7dKeys = {
  all: ['recent-orders-7d'] as const,
}

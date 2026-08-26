// ============================================
// QUERY KEYS — Naročila, Kuhinja, Meni, Mize, Zaposleni
// ============================================

export const ordersKeys = {
  all: ['orders'] as const,
  byStatus: (status: string) => ['orders', { status }] as const,
  byTable: (tableId: string) => ['orders', { tableId }] as const,
  active: ['active-orders'] as const,
  stats: ['order-stats'] as const,
  sidebar: ['sidebar-orders'] as const,
  waiter: ['waiter-orders'] as const,
  kds: ['kds-orders'] as const,
}

export const kitchenKeys = {
  all: ['kitchen'] as const,
  pacing: ['kitchen-pacing'] as const,
  prepQueue: ['kitchen-prep-queue'] as const,
}

export const menusKeys = {
  all: ['menus'] as const,
}

export const categoriesKeys = {
  all: ['categories'] as const,
}

export const menuItemsKeys = {
  all: ['menu-items'] as const,
  allergens: ['menu-items-allergens'] as const,
}

export const modifierGroupsKeys = {
  all: ['modifier-groups'] as const,
}

export const tablesKeys = {
  all: ['tables'] as const,
  orders: (tableId: string) => ['table-orders', tableId] as const,
  turnover: ['tables-turnover'] as const,
  turnoverByPeriod: (period: string) => ['orders-turnover', period] as const,
}

export const employeesKeys = {
  all: ['employees'] as const,
  performance: (period: string) => ['staff-performance', period] as const,
}

export const shiftsKeys = {
  all: ['shifts'] as const,
  schedule: ['shifts-schedule'] as const,
  scheduleEmployees: ['schedule-employees'] as const,
  timeEntries: ['time-entries'] as const,
}

export const jobsKeys = {
  all: ['jobs'] as const,
}

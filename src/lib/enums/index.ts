// ============================================
// ENUMS — Centralni TypeScript enum slovar
//
// ISSUE #41: 0 enumov — 20+ status polj so prosto-besedilni String-i.
// Prisma shema uporablja String (brez Prisma Enum-a) za backward compat
// in fleksibilnost. Ta modul doda typed layer nad obstoječimi String-i:
//
//   - TS const objects (literal union types) za type-safety v novi kodi
//   - Validatorji (isXxxStatus) za runtime validacijo
//   - Maps za prikaz v UI (labeli, ikone, barve)
//   - getEnumStats() za migracijski dashboard
//
// Pristop:
//   1. NE spreminjaj Prisma sheme (prevelika sprememba)
//   2. DODAJ typed const objects (TS-time safety)
//   3. DODAJ runtime validatorje (catch typo-je v API input)
//   4. V prihodnosti: Prisma @map na Enum (Faza 3, v1.0.0)
// ============================================

// ────────────────────────────────────────────
// ORDER STATUS
// ────────────────────────────────────────────
export const ORDER_STATUS = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(ORDER_STATUS).includes(value as OrderStatus)
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Na čakanju',
  preparing: 'V pripravi',
  ready: 'Pripravljeno',
  completed: 'Zaključeno',
  cancelled: 'Preklicano',
  refunded: 'Vrnjeno',
}

// ────────────────────────────────────────────
// ORDER TYPE
// ────────────────────────────────────────────
export const ORDER_TYPE = {
  DINE_IN: 'dine-in',
  TAKEOUT: 'takeout',
  DELIVERY: 'delivery',
} as const
export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE]

export function isOrderType(value: string): value is OrderType {
  return Object.values(ORDER_TYPE).includes(value as OrderType)
}

// ────────────────────────────────────────────
// PAYMENT STATUS
// ────────────────────────────────────────────
export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
} as const
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

export function isPaymentStatus(value: string): value is PaymentStatus {
  return Object.values(PAYMENT_STATUS).includes(value as PaymentStatus)
}

// ────────────────────────────────────────────
// PAYMENT RESULT STATUS (Payment model — completed/refunded/voided)
// ────────────────────────────────────────────
export const PAYMENT_RESULT_STATUS = {
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
} as const
export type PaymentResultStatus = (typeof PAYMENT_RESULT_STATUS)[keyof typeof PAYMENT_RESULT_STATUS]

export function isPaymentResultStatus(value: string): value is PaymentResultStatus {
  return Object.values(PAYMENT_RESULT_STATUS).includes(value as PaymentResultStatus)
}

// ────────────────────────────────────────────
// SHIFT STATUS
// ────────────────────────────────────────────
export const SHIFT_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ABSENT: 'absent',
} as const
export type ShiftStatus = (typeof SHIFT_STATUS)[keyof typeof SHIFT_STATUS]

export function isShiftStatus(value: string): value is ShiftStatus {
  return Object.values(SHIFT_STATUS).includes(value as ShiftStatus)
}

// ────────────────────────────────────────────
// STAFF SHIFT STATUS (StaffShift model — extended)
// ────────────────────────────────────────────
export const STAFF_SHIFT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const
export type StaffShiftStatus = (typeof STAFF_SHIFT_STATUS)[keyof typeof STAFF_SHIFT_STATUS]

export function isStaffShiftStatus(value: string): value is StaffShiftStatus {
  return Object.values(STAFF_SHIFT_STATUS).includes(value as StaffShiftStatus)
}

// ────────────────────────────────────────────
// STAFF SHIFT TYPE
// ────────────────────────────────────────────
export const SHIFT_TYPE = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  NIGHT: 'night',
  SPLIT: 'split',
  CUSTOM: 'custom',
} as const
export type ShiftType = (typeof SHIFT_TYPE)[keyof typeof SHIFT_TYPE]

export function isShiftType(value: string): value is ShiftType {
  return Object.values(SHIFT_TYPE).includes(value as ShiftType)
}

// ────────────────────────────────────────────
// ACCOUNTS PAYABLE / RECEIVABLE STATUS
// ────────────────────────────────────────────
export const AP_AR_STATUS = {
  OPEN: 'open',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const
export type ApArStatus = (typeof AP_AR_STATUS)[keyof typeof AP_AR_STATUS]

export function isApArStatus(value: string): value is ApArStatus {
  return Object.values(AP_AR_STATUS).includes(value as ApArStatus)
}

// ────────────────────────────────────────────
// JOURNAL ENTRY STATUS
// ────────────────────────────────────────────
export const JOURNAL_ENTRY_STATUS = {
  DRAFT: 'draft',
  POSTED: 'posted',
  REVERSED: 'reversed',
} as const
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUS)[keyof typeof JOURNAL_ENTRY_STATUS]

export function isJournalEntryStatus(value: string): value is JournalEntryStatus {
  return Object.values(JOURNAL_ENTRY_STATUS).includes(value as JournalEntryStatus)
}

// ────────────────────────────────────────────
// ACCOUNT TYPE (ChartOfAccount)
// ────────────────────────────────────────────
export const ACCOUNT_TYPE = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense',
} as const
export type AccountType = (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE]

export function isAccountType(value: string): value is AccountType {
  return Object.values(ACCOUNT_TYPE).includes(value as AccountType)
}

// ────────────────────────────────────────────
// LOCATION TYPE
// ────────────────────────────────────────────
export const LOCATION_TYPE = {
  RESTAURANT: 'restaurant',
  FOOD_TRUCK: 'food_truck',
  POP_UP: 'pop_up',
  CLOUD_KITCHEN: 'cloud_kitchen',
  BAR: 'bar',
} as const
export type LocationType = (typeof LOCATION_TYPE)[keyof typeof LOCATION_TYPE]

export function isLocationType(value: string): value is LocationType {
  return Object.values(LOCATION_TYPE).includes(value as LocationType)
}

// ────────────────────────────────────────────
// SUBSCRIPTION PLAN
// ────────────────────────────────────────────
export const SUBSCRIPTION_PLAN = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLAN)[keyof typeof SUBSCRIPTION_PLAN]

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return Object.values(SUBSCRIPTION_PLAN).includes(value as SubscriptionPlan)
}

// ────────────────────────────────────────────
// SUBSCRIPTION STATUS
// ────────────────────────────────────────────
export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return Object.values(SUBSCRIPTION_STATUS).includes(value as SubscriptionStatus)
}

// ────────────────────────────────────────────
// FURS ENVIRONMENT
// ────────────────────────────────────────────
export const FURS_ENVIRONMENT = {
  TEST: 'test',
  PRODUCTION: 'production',
} as const
export type FursEnvironment = (typeof FURS_ENVIRONMENT)[keyof typeof FURS_ENVIRONMENT]

export function isFursEnvironment(value: string): value is FursEnvironment {
  return Object.values(FURS_ENVIRONMENT).includes(value as FursEnvironment)
}

// ────────────────────────────────────────────
// GENERIC HELPER — vrne vse veljavne vrednosti za enum
// ────────────────────────────────────────────
export function enumValues<T extends Record<string, string>>(enumObj: T): string[] {
  return Object.values(enumObj)
}

// ────────────────────────────────────────────
// MIGRACIJSKI DASHBOARD — števec koliko modelov/klicev uporablja typed status
// ────────────────────────────────────────────
export interface EnumStats {
  /** Skupno število definiranih enumov */
  totalEnums: number
  /** Skupno število veljavnih vrednosti v vseh enumih */
  totalValues: number
  /** Število TS type-guards (isXxxStatus funkcije) */
  totalTypeGuards: number
  /** Ali Prisma schema uporablja @map ali Enum tip */
  usesPrismaEnum: boolean
  /** Priporočila za migracijo */
  recommendations: string[]
}

export function getEnumStats(): EnumStats {
  const enums = [
    { name: 'ORDER_STATUS', count: Object.keys(ORDER_STATUS).length },
    { name: 'ORDER_TYPE', count: Object.keys(ORDER_TYPE).length },
    { name: 'PAYMENT_STATUS', count: Object.keys(PAYMENT_STATUS).length },
    { name: 'PAYMENT_RESULT_STATUS', count: Object.keys(PAYMENT_RESULT_STATUS).length },
    { name: 'SHIFT_STATUS', count: Object.keys(SHIFT_STATUS).length },
    { name: 'STAFF_SHIFT_STATUS', count: Object.keys(STAFF_SHIFT_STATUS).length },
    { name: 'SHIFT_TYPE', count: Object.keys(SHIFT_TYPE).length },
    { name: 'AP_AR_STATUS', count: Object.keys(AP_AR_STATUS).length },
    { name: 'JOURNAL_ENTRY_STATUS', count: Object.keys(JOURNAL_ENTRY_STATUS).length },
    { name: 'ACCOUNT_TYPE', count: Object.keys(ACCOUNT_TYPE).length },
    { name: 'LOCATION_TYPE', count: Object.keys(LOCATION_TYPE).length },
    { name: 'SUBSCRIPTION_PLAN', count: Object.keys(SUBSCRIPTION_PLAN).length },
    { name: 'SUBSCRIPTION_STATUS', count: Object.keys(SUBSCRIPTION_STATUS).length },
    { name: 'FURS_ENVIRONMENT', count: Object.keys(FURS_ENVIRONMENT).length },
  ]

  const totalValues = enums.reduce((sum, e) => sum + e.count, 0)
  const totalTypeGuards = enums.length

  return {
    totalEnums: enums.length,
    totalValues,
    totalTypeGuards,
    usesPrismaEnum: false,
    recommendations: [
      `✅ ${enums.length} TS enumov definiranih z ${totalValues} veljavnimi vrednostmi.`,
      `✅ ${totalTypeGuards} TS type-guards funkcij za runtime validacijo API input.`,
      '📋 Phase 2: postopno uporabljaj type-guards v API rutah (npr. `assertOrderStatus(body.status)`).',
      '🔧 Phase 3 (v1.0.0): Prisma @map na Enum za DB-level constraint.',
      '💡 Prednosti: catch typo-je pri compile-time (npr. "pendig" namesto "pending").',
    ],
  }
}

// ============================================
// ENUMS — Centralni TypeScript enum slovar (posodobljeno R156-b)
//
// ISSUE #41 (R156-b): Prisma schema ZDAJ uporablja 20 NATIVNIH enumov
// (prisma/schema.prisma). Ta modul je app-layer most:
//
//   - NATIVNI enumi: re-export runtime objektov + tipov iz @prisma/client;
//     const objects (UPPERCASE ključi) se vežejo na Prisma člane — en vir
//     resnice, ni ročnih seznamov ki bi zdrsali (prej: ORDER_STATUS je imel
//     preparing/refunded, PAYMENT_STATUS je manjkal storno — R156-a audit).
//   - DASH unije (Order.status 'in-progress', Order.type 'dine-in',
//     StockTransaction.type 'write-off'): DB stolpci ostanejo TEXT, ker
//     Prisma P1012 prepoveduje `-` v enum vrednostih, @map pa bi na wire
//     poslal IME člana namesto DB vrednosti (zlom API kontrakta). Zato
//     eksplicitne string-literal unije tukaj.
//   - OSTALI (deferred) statusi: TS const objects kot prej (prihodnja runda).
//
// Wire kontrakt: Prisma enum se serializira kot navaden string — vrednosti
// so byte-identične z dosedanjimi String vrednostmi (ground truth: zod +
// dejanska write mesta, R156-a audit; seznami v issueju #41 so zastareli).
// ============================================

import {
  OrderItemStatus,
  PaymentStatus,
  PaymentType,
  EmployeeRole,
  EmployeeStatus,
  TableStatus,
  FiscalStatus,
  PurchaseOrderStatus,
  PurchaseOrderItemStatus,
  JournalEntryStatus,
  AccountType,
  HaccpCategory,
  HaccpStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  StaffShiftStatus,
  TimeEntryType,
  TimeEntryStatus,
  ReservationStatus,
  ReservationSource,
} from '@prisma/client'

// ────────────────────────────────────────────
// NATIVNI PRISMA ENUMI (R156-b, 20) — re-export runtime objektov + tipov.
// Uporaba: `import { OrderItemStatus } from '@/lib/enums'` (ali direktno iz
// '@prisma/client' — ista vrednost). Runtime: OrderItemStatus.ready === 'ready'.
// ────────────────────────────────────────────
export {
  OrderItemStatus,
  PaymentStatus,
  PaymentType,
  EmployeeRole,
  EmployeeStatus,
  TableStatus,
  FiscalStatus,
  PurchaseOrderStatus,
  PurchaseOrderItemStatus,
  JournalEntryStatus,
  AccountType,
  HaccpCategory,
  HaccpStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  StaffShiftStatus,
  TimeEntryType,
  TimeEntryStatus,
  ReservationStatus,
  ReservationSource,
}

// ────────────────────────────────────────────
// ORDER STATUS — DASH unija (Order.status; DB stolpec ostaja TEXT)
// Ground truth (R156-a audit): pending, in-progress, ready, completed,
// cancelled, served. ('preparing' je OrderItem.status, 'paid' je
// paymentStatus, 'served' se piše prek posebnega action endpointa.)
// ────────────────────────────────────────────
export const ORDER_STATUSES = ['pending', 'in-progress', 'ready', 'completed', 'cancelled', 'served'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  SERVED: 'served',
} as const

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value)
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Na čakanju',
  'in-progress': 'V obdelavi',
  ready: 'Pripravljeno',
  completed: 'Zaključeno',
  cancelled: 'Preklicano',
  served: 'Postreženo',
}

// ────────────────────────────────────────────
// ORDER TYPE — DASH unija (Order.type; DB stolpec ostaja TEXT)
// ────────────────────────────────────────────
export const ORDER_TYPES = ['dine-in', 'takeout', 'delivery'] as const
export type OrderType = (typeof ORDER_TYPES)[number]

export const ORDER_TYPE = {
  DINE_IN: 'dine-in',
  TAKEOUT: 'takeout',
  DELIVERY: 'delivery',
} as const

export function isOrderType(value: string): value is OrderType {
  return (ORDER_TYPES as readonly string[]).includes(value)
}

// ────────────────────────────────────────────
// STOCK TRANSACTION TYPE — DASH unija (StockTransaction.type; DB ostaja TEXT)
// Ground truth: procurement, sale, write-off, adjustment, return.
// API zod namerno sprejema samo 3 od 5 (sale/return so interni) — tukaj je
// POLNA množica (ledger resnica), validacija API meje ostane v zod.
// ────────────────────────────────────────────
export const STOCK_TRANSACTION_TYPES = ['procurement', 'sale', 'write-off', 'adjustment', 'return'] as const
export type StockTransactionType = (typeof STOCK_TRANSACTION_TYPES)[number]

export function isStockTransactionType(value: string): value is StockTransactionType {
  return (STOCK_TRANSACTION_TYPES as readonly string[]).includes(value)
}

// ────────────────────────────────────────────
// PAYMENT STATUS (Order.paymentStatus / Check.paymentStatus — NATIVNI enum)
// ────────────────────────────────────────────
export const PAYMENT_STATUS = {
  UNPAID: PaymentStatus.unpaid,
  PARTIAL: PaymentStatus.partial,
  PAID: PaymentStatus.paid,
  STORNO: PaymentStatus.storno,
} as const

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (Object.values(PaymentStatus) as string[]).includes(value)
}

// ────────────────────────────────────────────
// PAYMENT RESULT STATUS (Payment.model — completed/refunded/voided;
// DEFERRED: ni pretvorjen v enum v tej rundi)
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
// SHIFT STATUS (legacy Shift model — odstranjen v #36; obdržano za compat)
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
// STAFF SHIFT STATUS (StaffShift.status — NATIVNI enum)
// SAMO 4 člani: confirmed/cancelled/no_show iz starega schema komentarja sta
// bila ASPIRATIVNA (0 write mest — R156-a audit).
// ────────────────────────────────────────────
export const STAFF_SHIFT_STATUS = {
  SCHEDULED: StaffShiftStatus.scheduled,
  CONFIRMED: StaffShiftStatus.confirmed,
  IN_PROGRESS: StaffShiftStatus.in_progress,
  COMPLETED: StaffShiftStatus.completed,
  ABSENT: StaffShiftStatus.absent,
  CANCELLED: StaffShiftStatus.cancelled,
  NO_SHOW: StaffShiftStatus.no_show,
} as const

export function isStaffShiftStatus(value: string): value is StaffShiftStatus {
  return (Object.values(StaffShiftStatus) as string[]).includes(value)
}

// ────────────────────────────────────────────
// STAFF SHIFT TYPE (StaffShift.shiftType — DEFERRED: String v DB)
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
// ACCOUNTS PAYABLE / RECEIVABLE STATUS (DEFERRED: String v DB)
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
// JOURNAL ENTRY STATUS (JournalEntry.status — NATIVNI enum)
// ────────────────────────────────────────────
export const JOURNAL_ENTRY_STATUS = {
  DRAFT: JournalEntryStatus.draft,
  POSTED: JournalEntryStatus.posted,
  REVERSED: JournalEntryStatus.reversed,
} as const

export function isJournalEntryStatus(value: string): value is JournalEntryStatus {
  return (Object.values(JournalEntryStatus) as string[]).includes(value)
}

// ────────────────────────────────────────────
// ACCOUNT TYPE (ChartOfAccount.accountType / JournalLine.accountType — NATIVNI enum)
// ────────────────────────────────────────────
export const ACCOUNT_TYPE = {
  ASSET: AccountType.asset,
  LIABILITY: AccountType.liability,
  EQUITY: AccountType.equity,
  REVENUE: AccountType.revenue,
  EXPENSE: AccountType.expense,
} as const

export function isAccountType(value: string): value is AccountType {
  return (Object.values(AccountType) as string[]).includes(value)
}

// ────────────────────────────────────────────
// LOCATION TYPE (Location.type — IZKLJUČEN: odprt nabor, ostaja String)
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
// SUBSCRIPTION PLAN (Subscription.plan — NATIVNI enum)
// ────────────────────────────────────────────
export const SUBSCRIPTION_PLAN = {
  STARTER: SubscriptionPlan.starter,
  PROFESSIONAL: SubscriptionPlan.professional,
  ENTERPRISE: SubscriptionPlan.enterprise,
} as const

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return (Object.values(SubscriptionPlan) as string[]).includes(value)
}

// ────────────────────────────────────────────
// SUBSCRIPTION STATUS (Subscription.status — NATIVNI enum)
// ────────────────────────────────────────────
export const SUBSCRIPTION_STATUS = {
  TRIAL: SubscriptionStatus.trial,
  ACTIVE: SubscriptionStatus.active,
  PAST_DUE: SubscriptionStatus.past_due,
  CANCELLED: SubscriptionStatus.cancelled,
  EXPIRED: SubscriptionStatus.expired,
} as const

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (Object.values(SubscriptionStatus) as string[]).includes(value)
}

// ────────────────────────────────────────────
// FURS ENVIRONMENT (ni DB stolpec — konfiguracija)
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
  /** Ali Prisma schema uporablja native Enum tip (R156-b: TRUE za 20 polj) */
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
    usesPrismaEnum: true, // R156-b: 20 polj je zdaj native Prisma enumov
    recommendations: [
      `✅ ${enums.length} TS enumov definiranih z ${totalValues} veljavnimi vrednostmi.`,
      `✅ ${totalTypeGuards} TS type-guards funkcij za runtime validacijo API input.`,
      '✅ Phase 3 (R156-b, issue #41): 20 polj je zdaj NATIVNIH Prisma enumov — DB-level integriteta, wire nespremenjen.',
      '📋 Phase 3 preostanek (prihodnja runda): dash vrednosti (Order.status/type, StockTransaction.type — app-layer unije) + UPPERCASE grozd (InventoryBatch/Stocktake/DailyClose...) ostajajo String.',
      '💡 Prednosti: catch typo-je pri compile-time (npr. "pendig" namesto "pending").',
    ],
  }
}

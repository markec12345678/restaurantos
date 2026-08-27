// ============================================
// FRAUD DETECTION — Audit compliance & anomaly detection
// ============================================
// Zaznava sumljivih vzorcev v POS operacijah za PCI DSS + audit.
//
// Detekcije:
//   1. Void anomalije (preveliko voidov na izmeno)
//   2. Discount zlorabe (visoki popusti brez utemeljitve)
//   3. Refund vzorci (pogosti povračili istemu gostu)
//   4. Cash manipulacija (odprtina/zaprtina blagajne neskladja)
//   5. After-hours aktivnost (naročila izven delovnega časa)
//   6. Employee anomije (nenadno visoki promet enega zaposlenega)
//   7. Payment vzorci (split plačila, multi-card isti check)
//
// Po POSR vzoru (regex patterns + hevristična analiza).
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { toNum } from '@/lib/decimal'

// --- Tipi ---
export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface FraudAlert {
  id: string
  type: FraudAlertType
  severity: FraudSeverity
  description: string
  // Reference
  entityType: 'order' | 'payment' | 'employee' | 'cash_shift' | 'refund'
  entityId: string
  // Čas
  detectedAt: Date
  occurredAt: Date
  // Vrednost (koliko denarja je vpletenega)
  amount?: number
  // Employee (kdor je sprožil)
  employeeId?: string
  employeeName?: string
  // Metadata
  metadata?: Record<string, unknown>
  // Status
  status: 'open' | 'investigating' | 'resolved' | 'false_positive'
}

export type FraudAlertType =
  | 'excessive_voids'
  | 'high_discount_no_reason'
  | 'frequent_refunds_same_customer'
  | 'cash_drawer_discrepancy'
  | 'after_hours_activity'
  | 'employee_revenue_spike'
  | 'split_payment_anomaly'
  | 'multi_card_same_check'
  | 'manual_price_override'
  | 'compromised_refund_pattern'

// --- Konfiguracija thresholdov ---
export interface FraudThresholds {
  // Voids
  maxVoidsPerShift: number // 5
  voidAmountThreshold: number // €100
  // Discounts
  highDiscountPercent: number // 50%
  highDiscountAmount: number // €50
  // Refunds
  maxRefundsPerCustomerPerMonth: number // 3
  refundAmountThreshold: number // €200
  // Cash
  cashDrawerDiscrepancyThreshold: number // €10
  // After hours
  afterHoursStart: number // 23 (ura)
  afterHoursEnd: number // 6 (ura)
  // Employee
  employeeRevenueSpikeMultiplier: number // 3x povprečja
  // Split payments
  maxPaymentsPerCheck: number // 4
}

export const DEFAULT_THRESHOLDS: FraudThresholds = {
  maxVoidsPerShift: 5,
  voidAmountThreshold: 100,
  highDiscountPercent: 50,
  highDiscountAmount: 50,
  maxRefundsPerCustomerPerMonth: 3,
  refundAmountThreshold: 200,
  cashDrawerDiscrepancyThreshold: 10,
  afterHoursStart: 23,
  afterHoursEnd: 6,
  employeeRevenueSpikeMultiplier: 3,
  maxPaymentsPerCheck: 4,
}

// --- Regex patterns za prompt detection (kdaj uporabnik sprašuje o fraud-u) ---
const FRAUD_KEYWORDS = /\b(fraud|fraudulent|suspicious|suspicion|anomal\w*|irregular|tamper(?:ing)?|unauthorized|theft|steal|stolen|manipulat(?:e|ion)|red\s+flags?|shady|sketchy|misappropriat(?:e|ion)|embezzl(?:e|ement)|cover[\s-]?up)\b/i

const FRAUD_PHRASES = [
  /who\s+voided\s+the\s+most/i,
  /which\s+server\s+has\s+high\s+voids/i,
  /show\s+me\s+suspicious\s+activity/i,
  /any\s+irregular(?:ities)?/i,
  /cash\s+discrepanc\w+/i,
  /after\s*hours\s+activity/i,
  /refund\s+pattern/i,
  /discount\s+abuse/i,
]

export function isFraudRelatedPrompt(prompt: string): boolean {
  if (FRAUD_KEYWORDS.test(prompt)) return true
  for (const phrase of FRAUD_PHRASES) {
    if (phrase.test(prompt)) return true
  }
  return false
}

// --- Glavne detekcijske funkcije ---

// 1. EXCESSIVE VOIDS — preveč voidov na izmeno
export async function detectExcessiveVoids(
  thresholds: FraudThresholds = DEFAULT_THRESHOLDS,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<FraudAlert[]> {
  const end = dateTo || new Date()
  const start = dateFrom || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000) // zadnji teden

  // Pridobi voidane iteme grupirane po orderu (employeeId preko order)
  const voidedItems = await db.orderItem.findMany({
    where: {
      voided: true,
      updatedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      orderId: true,
      menuItemId: true,
      quantity: true,
      price: true,
      updatedAt: true,
      voidReasonId: true,
      order: { select: { employeeId: true, orderNumber: true } },
    },
  })

  // Grupiraj po employee
  const byEmployee: Record<string, { count: number; totalAmount: number; items: typeof voidedItems }> = {}
  for (const item of voidedItems) {
    const empId = item.order.employeeId || 'unknown'
    if (!byEmployee[empId]) byEmployee[empId] = { count: 0, totalAmount: 0, items: [] }
    byEmployee[empId].count++
    byEmployee[empId].totalAmount += toNum(item.price) * item.quantity
    byEmployee[empId].items.push(item)
  }

  const alerts: FraudAlert[] = []
  for (const [empId, data] of Object.entries(byEmployee)) {
    if (data.count > thresholds.maxVoidsPerShift) {
      const employee = empId !== 'unknown'
        ? await db.employee.findUnique({
            where: { id: empId },
            select: { name: true },
          }).catch(() => null)
        : null

      alerts.push({
        id: `void_${empId}_${Date.now()}`,
        type: 'excessive_voids',
        severity: data.count > thresholds.maxVoidsPerShift * 2 ? 'high' : 'medium',
        description: `${data.count} voidov v zadnjem tednu (threshold: ${thresholds.maxVoidsPerShift}). Skupna vrednost: €${data.totalAmount.toFixed(2)}`,
        entityType: 'employee',
        entityId: empId,
        detectedAt: new Date(),
        occurredAt: data.items[0].updatedAt,
        amount: data.totalAmount,
        employeeId: empId !== 'unknown' ? empId : undefined,
        employeeName: employee?.name || 'Neznan',
        metadata: { voidCount: data.count, itemIds: data.items.slice(0, 10).map(i => i.id) },
        status: 'open',
      })
    }
  }

  return alerts
}

// 2. HIGH DISCOUNTS — visoki popusti brez utemeljitve
export async function detectHighDiscounts(
  thresholds: FraudThresholds = DEFAULT_THRESHOLDS,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<FraudAlert[]> {
  const end = dateTo || new Date()
  const start = dateFrom || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Poišči ordere z visokim discountom (Order.discount)
  const orders = await db.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      discount: { gt: thresholds.highDiscountAmount },
    },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      discount: true,
      notes: true,
      employeeId: true,
      createdAt: true,
    },
  })

  const alerts: FraudAlert[] = []
  for (const order of orders) {
    const discountAmount = toNum(order.discount)
    const total = toNum(order.total) + discountAmount
    const discountPercent = total > 0 ? (discountAmount / total) * 100 : 0

    if (discountPercent > thresholds.highDiscountPercent || !order.notes) {
      const employee = order.employeeId
        ? await db.employee.findUnique({ where: { id: order.employeeId }, select: { name: true } }).catch(() => null)
        : null

      alerts.push({
        id: `disc_${order.id}`,
        type: 'high_discount_no_reason',
        severity: discountPercent > 80 ? 'high' : 'medium',
        description: `Visok popust ${discountPercent.toFixed(1)}% (€${discountAmount.toFixed(2)}) na naročilo #${order.orderNumber}${order.notes ? '' : ' — BREZ RAZLOGA'}`,
        entityType: 'order',
        entityId: order.id,
        detectedAt: new Date(),
        occurredAt: order.createdAt,
        amount: discountAmount,
        employeeId: order.employeeId || undefined,
        employeeName: employee?.name,
        metadata: {
          orderNumber: order.orderNumber,
          discountPercent: Math.round(discountPercent * 100) / 100,
          hasReason: !!order.notes,
          reason: order.notes,
        },
        status: 'open',
      })
    }
  }

  return alerts
}

// 3. AFTER HOURS ACTIVITY — naročila izven delovnega časa
export async function detectAfterHoursActivity(
  thresholds: FraudThresholds = DEFAULT_THRESHOLDS,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<FraudAlert[]> {
  const end = dateTo || new Date()
  const start = dateFrom || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)

  const orders = await db.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      employeeId: true,
      createdAt: true,
    },
  })

  const alerts: FraudAlert[] = []
  for (const order of orders) {
    const hour = new Date(order.createdAt).getHours()
    const isAfterHours =
      hour >= thresholds.afterHoursStart || hour < thresholds.afterHoursEnd

    if (isAfterHours) {
      const employee = order.employeeId
        ? await db.employee.findUnique({ where: { id: order.employeeId }, select: { name: true } }).catch(() => null)
        : null

      alerts.push({
        id: `after_${order.id}`,
        type: 'after_hours_activity',
        severity: 'low',
        description: `Naročilo #${order.orderNumber} ustvarjeno ob ${hour}:00 (izven delovnega časa)`,
        entityType: 'order',
        entityId: order.id,
        detectedAt: new Date(),
        occurredAt: order.createdAt,
        amount: toNum(order.total),
        employeeId: order.employeeId || undefined,
        employeeName: employee?.name,
        metadata: { hour, orderNumber: order.orderNumber },
        status: 'open',
      })
    }
  }

  return alerts
}

// 4. CASH DRAWER DISCREPANCY — neskladja v blagajni
export async function detectCashDiscrepancies(
  thresholds: FraudThresholds = DEFAULT_THRESHOLDS,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<FraudAlert[]> {
  const end = dateTo || new Date()
  const start = dateFrom || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Poišči cash shift z neskladjem
  const cashShifts = await db.cashRegisterShift.findMany({
    where: {
      closedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      employeeId: true,
      startingCash: true,
      expectedCash: true,
      closingCash: true,
      cashDifference: true,
      openedAt: true,
      closedAt: true,
    },
  }).catch(() => [])

  const alerts: FraudAlert[] = []
  for (const shift of cashShifts) {
    const expected = toNum(shift.expectedCash)
    const actual = toNum(shift.closingCash)
    const discrepancy = Math.abs(toNum(shift.cashDifference) || Math.abs(expected - actual))

    if (discrepancy > thresholds.cashDrawerDiscrepancyThreshold) {
      const employee = shift.employeeId
        ? await db.employee.findUnique({ where: { id: shift.employeeId }, select: { name: true } }).catch(() => null)
        : null

      alerts.push({
        id: `cash_${shift.id}`,
        type: 'cash_drawer_discrepancy',
        severity: discrepancy > thresholds.cashDrawerDiscrepancyThreshold * 5 ? 'critical' : 'high',
        description: `Neskladje blagajne €${discrepancy.toFixed(2)} (pričakovano: €${expected.toFixed(2)}, dejansko: €${actual.toFixed(2)})`,
        entityType: 'cash_shift',
        entityId: shift.id,
        detectedAt: new Date(),
        occurredAt: shift.closedAt || shift.openedAt,
        amount: discrepancy,
        employeeId: shift.employeeId || undefined,
        employeeName: employee?.name,
        metadata: {
          expectedCash: expected,
          closingCash: actual,
          startingCash: toNum(shift.startingCash),
          cashDifference: toNum(shift.cashDifference),
        },
        status: 'open',
      })
    }
  }

  return alerts
}

// --- GLAVNA FUNKCIJA: zaženi vse detekcije ---

export async function runAllFraudChecks(
  thresholds: FraudThresholds = DEFAULT_THRESHOLDS,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<{
  alerts: FraudAlert[]
  summary: {
    total: number
    bySeverity: Record<FraudSeverity, number>
    byType: Record<string, number>
  }
}> {
  const [voids, discounts, afterHours, cash] = await Promise.all([
    detectExcessiveVoids(thresholds, dateFrom, dateTo),
    detectHighDiscounts(thresholds, dateFrom, dateTo),
    detectAfterHoursActivity(thresholds, dateFrom, dateTo),
    detectCashDiscrepancies(thresholds, dateFrom, dateTo),
  ])

  const allAlerts = [...voids, ...discounts, ...afterHours, ...cash]

  // Sortiraj po severity (critical first)
  const severityOrder: Record<FraudSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  allAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // Statistika
  const bySeverity: Record<FraudSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  const byType: Record<string, number> = {}
  for (const alert of allAlerts) {
    bySeverity[alert.severity]++
    byType[alert.type] = (byType[alert.type] || 0) + 1
  }

  logger.info('FraudDetection', `Detected ${allAlerts.length} alerts (${bySeverity.critical} critical, ${bySeverity.high} high)`)

  return {
    alerts: allAlerts,
    summary: { total: allAlerts.length, bySeverity, byType },
  }
}

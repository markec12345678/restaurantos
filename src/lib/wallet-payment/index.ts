// ============================================
// WALLET PAYMENT — Apple Pay / Google Pay / NFC engine
// ============================================
// PCI DSS 4.0.1 (obvezno od 31. marca 2025):
//   - Tokenizacija: nikoli ne shranjujemo PAN-a (Primary Account Number)
//   - Device Account Number (DAN) replaces card number
//   - Cryptogram per-transakcijo (preprečuje replay attacks)
//
// Tok (Apple Pay):
//   1. Gost tapne iPhone na NFC reader
//   2. Stripe/Adyen terminal vrne paymentToken (encrypted)
//   3. Mi kreiramo WalletPayment z status="pending"
//   4. Pošljemo token skozi Payment Gateway (outbox)
//   5. Prejdemo status="authorized" → "captured"
//
// Tok (Google Pay):
//   1. Gost izbere Google Pay v aplikaciji
//   2. Sprejmemo paymentData JSON
//   3. Enako kot Apple Pay naprej
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { toNum, round2 } from '@/lib/decimal'
import { createOutboxEvent } from '@/lib/outbox'

// --- Tipi ---
export type WalletType = 'apple_pay' | 'google_pay' | 'samsung_pay' | 'nfc_card' | 'qr_pay'
export type WalletPaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'

export interface InitiateWalletPaymentInput {
  walletType: WalletType
  amount: number // v EUR
  currency?: string
  checkId?: string
  paymentId?: string
  deviceId?: string
  // Tokenizirani podatki iz denarnice
  paymentToken: string
  tokenType?: string
  // Opcijski metadata
  cardBrand?: string
  cardLast4?: string
}

export interface WalletPaymentResult {
  id: string
  status: WalletPaymentStatus
  transactionId: string
  amount: number
  message?: string
}

// --- Konstante ---

// Podprte denarnice
export const SUPPORTED_WALLETS: WalletType[] = [
  'apple_pay',
  'google_pay',
  'samsung_pay',
  'nfc_card',
  'qr_pay',
]

// Valute (ISO 4217)
export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF']

// Statusi
export const WALLET_STATUSES: WalletPaymentStatus[] = [
  'pending',
  'authorized',
  'captured',
  'failed',
  'refunded',
]

// PCI DSS: token se nikoli ne shrani v plain text
// V produkciji: HSM (Hardware Security Module) ali Stripe/Adyen tokenization
const TOKEN_MASK_LENGTH = 8

// --- Validacija ---

export function validateWalletPaymentInput(input: InitiateWalletPaymentInput): string | null {
  if (!SUPPORTED_WALLETS.includes(input.walletType)) {
    return `Nepodprta denarnica: ${input.walletType}`
  }
  if (input.amount <= 0) {
    return 'Znesek mora biti pozitiven'
  }
  if (input.amount > 10000) {
    return 'Znesek presega limit (€10.000)'
  }
  if (!input.paymentToken || input.paymentToken.length < 10) {
    return 'Manjka payment token'
  }
  if (input.currency && !SUPPORTED_CURRENCIES.includes(input.currency)) {
    return `Nepodprta valuta: ${input.currency}`
  }
  return null
}

// --- Mask token za logiranje (PCI DSS) ---
export function maskToken(token: string): string {
  if (token.length <= TOKEN_MASK_LENGTH) return '***'
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`
}

// --- Glavne funkcije ---

// 1. INICIACIJA plačila (gost tapne)
export async function initiateWalletPayment(
  input: InitiateWalletPaymentInput,
): Promise<WalletPaymentResult> {
  const validationError = validateWalletPaymentInput(input)
  if (validationError) {
    throw new Error(validationError)
  }

  // Kreiraj WalletPayment z pending statusom
  const walletPayment = await db.walletPayment.create({
    data: {
      paymentId: input.paymentId,
      checkId: input.checkId,
      walletType: input.walletType,
      amount: input.amount,
      currency: input.currency || 'EUR',
      paymentToken: input.paymentToken, // V produkciji: HSM encrypt
      tokenType: input.tokenType || '',
      cardBrand: input.cardBrand || '',
      cardLast4: input.cardLast4 || '',
      status: 'pending',
      deviceId: input.deviceId,
    },
  })

  logger.info(
    'WalletPayment',
    `Initiated ${input.walletType} payment ${walletPayment.id} (token: ${maskToken(input.paymentToken)}, amount: €${input.amount})`,
  )

  // Ustvari OutboxEvent za async procesiranje preko payment gateway-a
  await createOutboxEvent({
    aggregateType: 'payment',
    aggregateId: walletPayment.id,
    eventType: 'wallet_payment_initiated',
    payload: {
      walletPaymentId: walletPayment.id,
      walletType: input.walletType,
      amount: input.amount,
      currency: input.currency || 'EUR',
      paymentToken: input.paymentToken,
      tokenType: input.tokenType,
      checkId: input.checkId,
      paymentId: input.paymentId,
    },
    target: 'stripe',
    targetEndpoint: 'wallet_payment',
    idempotencyKey: `wallet_payment:${walletPayment.id}:initiate`,
  })

  return {
    id: walletPayment.id,
    status: 'pending',
    transactionId: walletPayment.id, // začasno — gateway bo vrnil svoj ID
    amount: input.amount,
    message: 'Plačilo poslano v obdelavo',
  }
}

// 2. POTRDIPLAČILO (gateway response webhook)
export async function authorizeWalletPayment(
  walletPaymentId: string,
  gatewayResponse: {
    transactionId: string
    cardBrand?: string
    cardLast4?: string
    status: 'authorized' | 'failed'
    errorCode?: string
    errorMessage?: string
  },
): Promise<WalletPaymentResult> {
  const walletPayment = await db.walletPayment.findUnique({
    where: { id: walletPaymentId },
  })
  if (!walletPayment) {
    throw new Error(`WalletPayment ${walletPaymentId} ne obstaja`)
  }

  if (walletPayment.status !== 'pending') {
    throw new Error(`WalletPayment ${walletPaymentId} ni v pending stanju (trenutno: ${walletPayment.status})`)
  }

  const updated = await db.walletPayment.update({
    where: { id: walletPaymentId },
    data: {
      status: gatewayResponse.status === 'authorized' ? 'authorized' : 'failed',
      transactionId: gatewayResponse.transactionId,
      cardBrand: gatewayResponse.cardBrand || walletPayment.cardBrand,
      cardLast4: gatewayResponse.cardLast4 || walletPayment.cardLast4,
      errorCode: gatewayResponse.errorCode || '',
      errorMessage: gatewayResponse.errorMessage || '',
    },
  })

  logger.info(
    'WalletPayment',
    `Authorized ${walletPaymentId}: ${updated.status} (txn: ${gatewayResponse.transactionId})`,
  )

  return {
    id: updated.id,
    status: updated.status as WalletPaymentStatus,
    transactionId: updated.transactionId,
    amount: toNum(updated.amount),
    message: gatewayResponse.status === 'authorized' ? 'Plačilo avtorizirano' : gatewayResponse.errorMessage,
  }
}

// 3. CAPTURE plačila (pooblastitev → dejansko breme)
export async function captureWalletPayment(
  walletPaymentId: string,
): Promise<WalletPaymentResult> {
  const walletPayment = await db.walletPayment.findUnique({
    where: { id: walletPaymentId },
  })
  if (!walletPayment) {
    throw new Error(`WalletPayment ${walletPaymentId} ne obstaja`)
  }

  if (walletPayment.status !== 'authorized') {
    throw new Error(`WalletPayment ${walletPaymentId} ni avtoriziran (trenutno: ${walletPayment.status})`)
  }

  const updated = await db.walletPayment.update({
    where: { id: walletPaymentId },
    data: {
      status: 'captured',
      capturedAt: new Date(),
    },
  })

  logger.info('WalletPayment', `Captured ${walletPaymentId}`)

  // Proži notranji dogodek za posodobitev Check/Order
  await createOutboxEvent({
    aggregateType: 'payment',
    aggregateId: walletPaymentId,
    eventType: 'wallet_payment_captured',
    payload: {
      walletPaymentId,
      amount: toNum(walletPayment.amount),
      currency: walletPayment.currency,
      checkId: walletPayment.checkId,
      paymentId: walletPayment.paymentId,
    },
    target: 'internal',
    idempotencyKey: `wallet_payment:${walletPaymentId}:capture`,
  })

  return {
    id: updated.id,
    status: 'captured',
    transactionId: updated.transactionId,
    amount: toNum(updated.amount),
    message: 'Plačilo uspešno realizirano',
  }
}

// 4. POVRAČILO
export async function refundWalletPayment(
  walletPaymentId: string,
  refundAmount: number,
): Promise<WalletPaymentResult> {
  const walletPayment = await db.walletPayment.findUnique({
    where: { id: walletPaymentId },
  })
  if (!walletPayment) {
    throw new Error(`WalletPayment ${walletPaymentId} ne obstaja`)
  }

  if (walletPayment.status !== 'captured') {
    throw new Error(`WalletPayment ${walletPaymentId} ni bil realiziran (trenutno: ${walletPayment.status})`)
  }

  const originalAmount = toNum(walletPayment.amount)
  const alreadyRefunded = toNum(walletPayment.refundedAmount)

  if (refundAmount <= 0 || refundAmount > originalAmount - alreadyRefunded) {
    throw new Error(`Neveljaven znesek povračila (preostanek: €${round2(originalAmount - alreadyRefunded)})`)
  }

  const newRefundedAmount = alreadyRefunded + refundAmount
  const isFullRefund = newRefundedAmount >= originalAmount

  const updated = await db.walletPayment.update({
    where: { id: walletPaymentId },
    data: {
      refundedAmount: newRefundedAmount,
      status: isFullRefund ? 'refunded' : 'captured', // delno ostane captured
    },
  })

  logger.info(
    'WalletPayment',
    `Refunded ${walletPaymentId}: €${refundAmount} (total refunded: €${newRefundedAmount})`,
  )

  // Outbox za gateway refund
  await createOutboxEvent({
    aggregateType: 'payment',
    aggregateId: walletPaymentId,
    eventType: 'wallet_payment_refunded',
    payload: {
      walletPaymentId,
      refundAmount,
      transactionId: walletPayment.transactionId,
    },
    target: 'stripe',
    targetEndpoint: 'refund',
    idempotencyKey: `wallet_payment:${walletPaymentId}:refund:${newRefundedAmount}`,
  })

  return {
    id: updated.id,
    status: updated.status as WalletPaymentStatus,
    transactionId: updated.transactionId,
    amount: toNum(updated.amount),
    message: isFullRefund ? 'Polno povračilo izvedeno' : `Delno povračilo (€${refundAmount})`,
  }
}

// 5. STATISTIKA za dashboard
export async function getWalletPaymentStats(dateFrom?: Date, dateTo?: Date) {
  const where: Record<string, unknown> = {}
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = dateFrom
    if (dateTo) (where.createdAt as Record<string, unknown>).lte = dateTo
  }

  const [byWallet, byStatus, totals] = await Promise.all([
    db.walletPayment.groupBy({
      by: ['walletType'],
      where,
      _count: { walletType: true },
      _sum: { amount: true },
    }),
    db.walletPayment.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
      _sum: { amount: true },
    }),
    db.walletPayment.aggregate({
      where,
      _count: { id: true },
      _sum: { amount: true, refundedAmount: true },
    }),
  ])

  return {
    totalPayments: totals._count.id,
    totalAmount: toNum(totals._sum.amount),
    totalRefunded: toNum(totals._sum.refundedAmount),
    byWallet: byWallet.map((w) => ({
      walletType: w.walletType,
      count: w._count.walletType,
      amount: toNum(w._sum.amount),
    })),
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: s._count.status,
      amount: toNum(s._sum.amount),
    })),
  }
}

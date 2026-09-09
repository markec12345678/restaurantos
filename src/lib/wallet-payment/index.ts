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
// P1-19 (concurrency): pogojni updateMany (status='pending') — ATOMICNA
// preprečitev check-then-act race-a. Prej: findUnique + status check + update
// kot trije ločeni koraki → dva sočasna webhook-a istega dogodka sta oba
// prebrala 'pending' in oba nadaljevala. Sedaj samo PRVI zmaga (count=1);
// konkurentne klice vržejo "ni v pending stanju" napako, ki jo webhook
// route obravnava idempotentno (isti končni status → 200 duplicate).
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
  // Atomarna statusna transicija pending → authorized/failed
  const claim = await db.walletPayment.updateMany({
    where: { id: walletPaymentId, status: 'pending' },
    data: {
      status: gatewayResponse.status === 'authorized' ? 'authorized' : 'failed',
      transactionId: gatewayResponse.transactionId,
      cardBrand: gatewayResponse.cardBrand || undefined,
      cardLast4: gatewayResponse.cardLast4 || undefined,
      errorCode: gatewayResponse.errorCode || '',
      errorMessage: gatewayResponse.errorMessage || '',
    },
  })

  if (claim.count === 0) {
    // Konkurentni klic je že obdelal ta wallet payment — preberi trenutni
    // status za ločevanje duplikata (idempotentno) od konflikta stanj (409).
    let currentStatus = 'unknown'
    try {
      const current = await db.walletPayment.findUnique({
        where: { id: walletPaymentId },
        select: { status: true },
      })
      currentStatus = current?.status ?? 'ne obstaja'
      if (!current) {
        throw new Error(`WalletPayment ${walletPaymentId} ne obstaja`)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('ne obstaja')) throw err
      currentStatus = 'unknown'
    }
    throw new Error(
      `WalletPayment ${walletPaymentId} ni v pending stanju (trenutno: ${currentStatus})`,
    )
  }

  const updated = await db.walletPayment.findUnique({
    where: { id: walletPaymentId },
  })
  if (!updated) {
    throw new Error(`WalletPayment ${walletPaymentId} ne obstaja`)
  }

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
// P1-19: pogojni updateMany (status='authorized') — prepreči dvojni capture
// ob sočasnih klicih (npr. webhook retry + ročni capture).
export async function captureWalletPayment(
  walletPaymentId: string,
): Promise<WalletPaymentResult> {
  const claim = await db.walletPayment.updateMany({
    where: { id: walletPaymentId, status: 'authorized' },
    data: {
      status: 'captured',
      capturedAt: new Date(),
    },
  })

  if (claim.count === 0) {
    const current = await db.walletPayment.findUnique({
      where: { id: walletPaymentId },
      select: { status: true },
    })
    if (!current) {
      throw new Error(`WalletPayment ${walletPaymentId} ne obstaja`)
    }
    throw new Error(`WalletPayment ${walletPaymentId} ni avtoriziran (trenutno: ${current.status})`)
  }

  const updated = await db.walletPayment.findUnique({
    where: { id: walletPaymentId },
  })
  if (!updated) {
    throw new Error(`WalletPayment ${walletPaymentId} ne obstaja`)
  }

  logger.info('WalletPayment', `Captured ${walletPaymentId}`)

  // Proži notranji dogodek za posodobitev Check/Order
  await createOutboxEvent({
    aggregateType: 'payment',
    aggregateId: walletPaymentId,
    eventType: 'wallet_payment_captured',
    payload: {
      walletPaymentId,
      amount: toNum(updated.amount),
      currency: updated.currency,
      checkId: updated.checkId,
      paymentId: updated.paymentId,
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
// P1-19 (concurrency): read-validate-write pod pg_advisory_xact_lock +
// INCREMENT namesto absolutnega zapisa. Prej: dvakrat sočasno delno vračilo
// je oba prebrala isti refundedAmount → izgubljen update (dvakrat vračeno,
// DB pa kazala enkrat). Zaklep + increment serializira kumulativo.
export async function refundWalletPayment(
  walletPaymentId: string,
  refundAmount: number,
): Promise<WalletPaymentResult> {
  const { updated, newRefundedAmount } = await db.$transaction(async (tx) => {
    // Zakleni vrstico — vzporedni refundi istega wallet payment čakajo
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'wallet-refund:' + walletPaymentId}))`

    // PONOVNO branje ZNOTRAJ zaklepa (avtoritativno stanje)
    const walletPayment = await tx.walletPayment.findUnique({
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

    const newRefundedTotal = alreadyRefunded + refundAmount
    const isFullRefund = newRefundedTotal >= originalAmount

    // INCREMENT — dodatna varovalka pred izgubljenimi update-i
    const updatedRow = await tx.walletPayment.update({
      where: { id: walletPaymentId },
      data: {
        refundedAmount: { increment: refundAmount },
        status: isFullRefund ? 'refunded' : 'captured', // delno ostane captured
      },
    })

    return { updated: updatedRow, newRefundedAmount: newRefundedTotal }
  })

  const isFullRefund = newRefundedAmount >= toNum(updated.amount)

  logger.info(
    'WalletPayment',
    `Refunded ${walletPaymentId}: €${refundAmount} (total refunded: €${newRefundedAmount})`,
  )

  // Outbox za gateway refund (po commit-u; idempotencyKey = kumulativa)
  await createOutboxEvent({
    aggregateType: 'payment',
    aggregateId: walletPaymentId,
    eventType: 'wallet_payment_refunded',
    payload: {
      walletPaymentId,
      refundAmount,
      transactionId: updated.transactionId,
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

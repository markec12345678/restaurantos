// ============================================
// /api/wallet-payment — Wallet Payments (Apple/Google Pay, NFC)
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import {
  initiateWalletPayment,
  getWalletPaymentStats,
  SUPPORTED_WALLETS,
  SUPPORTED_CURRENCIES,
  type WalletType,
} from '@/lib/wallet-payment'

export const dynamic = 'force-dynamic'

const initiateSchema = z.object({
  walletType: z.enum(SUPPORTED_WALLETS as [WalletType, ...WalletType[]]),
  amount: z.number().positive().max(10000),
  currency: z.enum(SUPPORTED_CURRENCIES as [string, ...string[]]).default('EUR'),
  checkId: z.string().max(100).optional(),
  paymentId: z.string().max(100).optional(),
  deviceId: z.string().max(200).optional(),
  paymentToken: z.string().min(10).max(10000),
  tokenType: z.string().max(50).optional(),
  cardBrand: z.string().max(50).optional(),
  cardLast4: z.string().max(4).optional(),
})

// GET — statistika + seznam plačil
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const stats = searchParams.get('stats') === '1'
    const walletType = searchParams.get('walletType')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    if (stats) {
      const from = dateFrom ? new Date(dateFrom) : undefined
      const to = dateTo ? new Date(dateTo) : undefined
      const result = await getWalletPaymentStats(from, to)
      return NextResponse.json({ stats: result })
    }

    const where: Record<string, unknown> = {}
    if (walletType) where.walletType = walletType
    if (status) where.status = status
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo)
    }

    const payments = await db.walletPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        walletType: true,
        amount: true,
        currency: true,
        status: true,
        transactionId: true,
        cardBrand: true,
        cardLast4: true,
        capturedAt: true,
        refundedAmount: true,
        createdAt: true,
        // paymentToken NAMERNO izpustimo — PCI DSS!
      },
    })

    return NextResponse.json({ payments, count: payments.length })
  } catch (err) {
    return handleApiError(err, 'wallet-payment GET')
  }
}

// POST — iniciiraj plačilo
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const input = initiateSchema.parse(body)

    const result = await initiateWalletPayment(input)

    return NextResponse.json({ success: true, ...result }, { status: 201 })
  } catch (err) {
    return handleApiError(err, 'wallet-payment POST')
  }
}

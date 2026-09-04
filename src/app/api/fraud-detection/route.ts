// ============================================
// /api/fraud-detection — Fraud alerts & detection
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import {
  runAllFraudChecks,
  isFraudRelatedPrompt,
  DEFAULT_THRESHOLDS,
  type FraudThresholds,
} from '@/lib/fraud-detection'

export const dynamic = 'force-dynamic'

// GET — pridobi fraud alerts za določeno obdobje
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const from = dateFrom ? new Date(dateFrom) : undefined
    const to = dateTo ? new Date(dateTo) : undefined

    const result = await runAllFraudChecks(DEFAULT_THRESHOLDS, from, to)

    return NextResponse.json(result)
  } catch (err) {
    return handleApiError(err, 'fraud-detection GET')
  }
}

// POST — ročno zaženi detekcijo ali preveri prompt
const actionSchema = z.object({
  action: z.enum(['run_checks', 'check_prompt']),
  prompt: z.string().optional(),
  thresholds: z.object({
    maxVoidsPerShift: z.number().optional(),
    voidAmountThreshold: z.number().optional(),
    highDiscountPercent: z.number().optional(),
    highDiscountAmount: z.number().optional(),
    maxRefundsPerCustomerPerMonth: z.number().optional(),
    refundAmountThreshold: z.number().optional(),
    cashDrawerDiscrepancyThreshold: z.number().optional(),
    afterHoursStart: z.number().optional(),
    afterHoursEnd: z.number().optional(),
    employeeRevenueSpikeMultiplier: z.number().optional(),
    maxPaymentsPerCheck: z.number().optional(),
  }).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({ action: 'run_checks' }))
    const input = actionSchema.parse(body)

    if (input.action === 'check_prompt') {
      if (!input.prompt) {
        return NextResponse.json({ error: 'prompt je obvezen za check_prompt akcijo' }, { status: 400 })
      }
      const isFraud = isFraudRelatedPrompt(input.prompt)
      return NextResponse.json({ prompt: input.prompt, isFraudRelated: isFraud })
    }

    if (input.action === 'run_checks') {
      const thresholds: FraudThresholds = {
        ...DEFAULT_THRESHOLDS,
        ...(input.thresholds || {}),
      }
      const from = input.dateFrom ? new Date(input.dateFrom) : undefined
      const to = input.dateTo ? new Date(input.dateTo) : undefined

      const result = await runAllFraudChecks(thresholds, from, to)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (err) {
    return handleApiError(err, 'fraud-detection POST')
  }
}

// ============================================
// /api/loyalty-automation — SMS Loyalty Automation
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import {
  processBirthdayBatch,
  processWinbackBatch,
  getLoyaltyAutomationStats,
  DEFAULT_CONFIG,
  type LoyaltyAutomationConfig,
} from '@/lib/loyalty-automation'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET — statistika
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const stats = await getLoyaltyAutomationStats()
    return NextResponse.json({ stats, config: DEFAULT_CONFIG })
  } catch (err) {
    return handleApiError(err, 'loyalty-automation GET')
  }
}

// POST — ročno sproži batch procese (admin/cron)
const actionSchema = z.object({
  action: z.enum(['birthday_batch', 'winback_batch', 'all']).default('all'),
  config: z.object({
    enabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    triggers: z.object({
      tierUpgrade: z.boolean().optional(),
      rewardUnlocked: z.boolean().optional(),
      birthdayBonus: z.boolean().optional(),
      winback: z.boolean().optional(),
      pointsExpiring: z.boolean().optional(),
      welcome: z.boolean().optional(),
    }).optional(),
    thresholds: z.object({
      rewardUnlockedPoints: z.number().optional(),
      pointsExpiringDays: z.number().optional(),
      winbackInactiveDays: z.number().optional(),
    }).optional(),
  }).optional(),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({ action: 'all' }))
    const input = actionSchema.parse(body)
    const config: LoyaltyAutomationConfig = {
      ...DEFAULT_CONFIG,
      ...(input.config || {}),
      triggers: { ...DEFAULT_CONFIG.triggers, ...(input.config?.triggers || {}) },
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...(input.config?.thresholds || {}) },
    }

    const results: Record<string, unknown> = {}

    if (input.action === 'birthday_batch' || input.action === 'all') {
      results.birthday = await processBirthdayBatch(config)
    }

    if (input.action === 'winback_batch' || input.action === 'all') {
      results.winback = await processWinbackBatch(config)
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return handleApiError(err, 'loyalty-automation POST')
  }
}

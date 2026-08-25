// GET /api/accounting/chart-of-accounts — Slovenski kontni načrt (SKM 2006)
// POST /api/accounting/chart-of-accounts — Dodaj/posodobi konto
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { z } from 'zod'

const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parentId: z.string().nullable().optional(),
  description: z.string().max(500).default(''),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const accountType = searchParams.get('accountType')

    const where: Record<string, unknown> = {}
    if (accountType) where.accountType = accountType

    const accounts = await db.chartOfAccount.findMany({
      where,
      orderBy: [{ accountType: 'asc' }, { sortOrder: 'asc' }],
      include: {
        _count: { select: { subAccounts: true } },
      },
    })

    return NextResponse.json({ accounts })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/accounting/chart-of-accounts', 'Napaka pri pridobivanju kontnega načrta')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, createAccountSchema)
    if (validationError) return validationError

    const account = await db.chartOfAccount.upsert({
      where: { code: data.code },
      update: {
        name: data.name,
        accountType: data.accountType,
        parentId: data.parentId || null,
        description: data.description,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
      create: data,
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/accounting/chart-of-accounts', 'Napaka pri ustvarjanju konta')
  }
}

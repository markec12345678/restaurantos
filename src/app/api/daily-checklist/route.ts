// ============================================
// DAILY CHECKLIST API — Kontrolni seznam za odpiranje/zapiranje
// Toast POS + Jolt/HotSchedules standard
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { saveChecklistSchema, getChecklistSchema, OPENING_CHECKLIST, CLOSING_CHECKLIST, ChecklistItem } from './_helpers'


export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const parsed = getChecklistSchema.safeParse({
      type: searchParams.get('type') || 'opening',
      date: searchParams.get('date'),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni parametri', validationErrors: parsed.error.issues.map(e => ({ field: e.path.join('.'), message: e.message })) },
        { status: 400 }
      )
    }

    const { type, date } = parsed.data
    const checklistDate = date || new Date().toISOString().split('T')[0]

    // Pridobi obstoječ checklist iz audit loga
    const existing = await db.auditLog.findFirst({
      where: {
        entityType: 'DailyChecklist',
        action: `CHECKLIST_${type.toUpperCase()}`,
        timestamp: {
          gte: new Date(`${checklistDate}T00:00:00`),
          lte: new Date(`${checklistDate}T23:59:59`),
        },
      },
      orderBy: { timestamp: 'desc' },
    })

    const parseDetails = (d: unknown): Record<string, unknown> => {
      if (typeof d === 'string') { try { return JSON.parse(d) } catch { return {} } }
      return (d as Record<string, unknown>) || {}
    }

    if (existing) {
      const details = parseDetails(existing.details)
      return NextResponse.json({
        checklist: details.checklist || [],
        type,
        date: checklistDate,
        status: details.status || 'pending',
        completedBy: details.completedBy || '',
        completedAt: details.completedAt || null,
      })
    }

    // Generiraj nov checklist
    const template = type === 'opening' ? OPENING_CHECKLIST : CLOSING_CHECKLIST
    const items: ChecklistItem[] = template.map((item, idx) => ({
      id: `${type}-${checklistDate}-${idx}`,
      task: item.task,
      category: item.category,
      completed: false,
    }))

    return NextResponse.json({
      checklist: items,
      type,
      date: checklistDate,
      status: 'pending',
      completedBy: '',
      completedAt: null,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/daily-checklist', 'Napaka pri pridobivanju kontrolnega seznama')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, saveChecklistSchema)
    if (validationError) return validationError

    const { type, date, checklist, status } = data
    const completedItems = checklist.filter(i => i.completed).length
    const totalItems = checklist.length
    const checklistStatus = status || (completedItems === totalItems ? 'completed' : 'in_progress')

    await createAuditLog({
      action: `CHECKLIST_${type.toUpperCase()}`,
      entityType: 'DailyChecklist',
      details: {
        type,
        date: date || new Date().toISOString().split('T')[0],
        checklist,
        status: checklistStatus,
        completedBy: authResult.session?.employeeId || '',
        completedAt: checklistStatus === 'completed' ? new Date().toISOString() : null,
        progress: `${completedItems}/${totalItems}`,
      } as Record<string, unknown>,
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json({
      success: true,
      status: checklistStatus,
      progress: `${completedItems}/${totalItems}`,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/daily-checklist', 'Napaka pri shranjevanju kontrolnega seznama')
  }
}

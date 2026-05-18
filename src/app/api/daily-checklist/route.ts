// ============================================
// DAILY CHECKLIST API — Kontrolni seznam za odpiranje/zapiranje
// Toast POS + Jolt/HotSchedules standard
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

interface ChecklistItem {
  id: string
  task: string
  category: string
  completed: boolean
  completedBy?: string
  completedAt?: string
  notes?: string
}

interface DailyChecklist {
  id: string
  date: string
  type: 'opening' | 'closing'
  items: ChecklistItem[]
  completedBy: string
  completedAt?: string
  status: 'pending' | 'in_progress' | 'completed'
}

// Default checklist templates
const OPENING_CHECKLIST: Omit<ChecklistItem, 'id' | 'completed' | 'completedBy' | 'completedAt' | 'notes'>[] = [
  { task: 'Vklopi POS sistem in preveri povezavo', category: 'sistemi' },
  { task: 'Preveri zalogo gotovine v blagajni', category: 'blagajna' },
  { task: 'Vklopi kavo in preveri temperaturo', category: 'kuhinja' },
  { task: 'Preveri temperaturo hladilnika (< 4°C)', category: 'kuhinja' },
  { task: 'Preveri temperaturo zamrzovalnika (< -18°C)', category: 'kuhinja' },
  { task: 'Odpihi pipe in preveri zalogo pijač', category: 'bár' },
  { task: 'Preveri čistost jedilnice in stranišč', category: 'čistost' },
  { task: 'Napolni servisetke in začimbe na mizah', category: 'jedilnica' },
  { task: 'Preveri rezervacije za danes', category: 'rezervacije' },
  { task: 'Pregled dnevne ponudbe s kuharji', category: 'kuhinja' },
  { task: 'Vklopi zvočno ozadje in razsvetljavo', category: 'jedilnica' },
  { task: 'Preveri zunanjo površino (terasa/vhod)', category: 'čistost' },
  { task: 'Preveri FURS povezavo in certifikat', category: 'sistemi' },
  { task: 'Posodobi posebne ponudbe na tabli', category: 'jedilnica' },
]

const CLOSING_CHECKLIST: Omit<ChecklistItem, 'id' | 'completed' | 'completedBy' | 'completedAt' | 'notes'>[] = [
  { task: 'Izpiši Z-poročilo in zaključi izmeno', category: 'blagajna' },
  { task: 'Prešteti gotovino in primerjaj z Z-poročilom', category: 'blagajna' },
  { task: 'Pripravi denar za naslednji dan', category: 'blagajna' },
  { task: 'Počisti kuhinjo in pulta', category: 'kuhinja' },
  { task: 'Shrani ostanke hrane (pravilno označi)', category: 'kuhinja' },
  { task: 'Izklopi kavo in kuhinjsko opremo', category: 'kuhinja' },
  { task: 'Počisti bar in shraní pijače', category: 'bár' },
  { task: 'Izklopi vse pipe', category: 'bár' },
  { task: 'Počisti jedilnico in mize', category: 'jedilnica' },
  { task: 'Izprazni smeti in loči odpadke', category: 'čistost' },
  { task: 'Počisti stranišča', category: 'čistost' },
  { task: 'Izklopi razsvetljavo in glasbo', category: 'jedilnica' },
  { task: 'Zakleni vhodna vrata', category: 'varnost' },
  { task: 'Vklopi alarm', category: 'varnost' },
  { task: 'Izklopi POS sistem (če je potrebno)', category: 'sistemi' },
]

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'opening' // opening, closing
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Pridobi obstoječ checklist iz audit loga
    const existing = await db.auditLog.findFirst({
      where: {
        entityType: 'DailyChecklist',
        action: `CHECKLIST_${type.toUpperCase()}`,
        timestamp: {
          gte: new Date(`${date}T00:00:00`),
          lte: new Date(`${date}T23:59:59`),
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
        date,
        status: details.status || 'pending',
        completedBy: details.completedBy || '',
        completedAt: details.completedAt || null,
      })
    }

    // Generiraj nov checklist
    const template = type === 'opening' ? OPENING_CHECKLIST : CLOSING_CHECKLIST
    const items: ChecklistItem[] = template.map((item, idx) => ({
      id: `${type}-${date}-${idx}`,
      task: item.task,
      category: item.category,
      completed: false,
    }))

    return NextResponse.json({
      checklist: items,
      type,
      date,
      status: 'pending',
      completedBy: '',
      completedAt: null,
    })
  } catch (error) {
    console.error('[DAILY-CHECKLIST GET]', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju kontrolnega seznama' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const { type, date, checklist, status } = body

    if (!type || !checklist) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    const completedItems = checklist.filter((i: ChecklistItem) => i.completed).length
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
  } catch (error) {
    console.error('[DAILY-CHECKLIST POST]', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju kontrolnega seznama' }, { status: 500 })
  }
}

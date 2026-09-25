'use client'

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { courseNameFor } from './constants'
import type { PacedOrder, CourseGroup, CourseItem, CourseItemStatus } from './constants'

/** Znani item statusi — neznana vrednost (defenzivno) → 'pending' */
const KNOWN_ITEM_STATUSES: readonly string[] = ['pending', 'held', 'fired', 'preparing', 'ready', 'served', 'cancelled']

function parseItemStatus(raw: unknown): CourseItemStatus {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return (KNOWN_ITEM_STATUSES as readonly string[]).includes(s) ? (s as CourseItemStatus) : 'pending'
}

// ============================================
// KURSNO TEMPO — REALNI PODATKI (kanon R134/10)
// ============================================
// Vir: GET /api/kitchen — itemi nosijo FLATTENED course polja
// (courseNumber / courseName / courseStatus / courseId), ki jih pristaja
// strežniška polovica R134. Kontrakt-defenzivno: vsa polja optional,
// Array.isArray guardi, parse NIKOLI ne vrže; legacy itemi brez course
// gredo v skupino 'Brez toka' (na koncu, brez akcij — ni courseId).
// Naročila BREZ vsaj enega toka niso del pacing pogleda (prazno stanje
// = "ni aktivnih naročil s tokovi").
// ============================================

/** Defenzivno branje številke toka: število ALI numeričen string, sicer null */
function parseCourseNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && Number.isInteger(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isInteger(n)) return n
  }
  return null
}

/** Defenzivno branje nepraznega stringa */
function parseString(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null
}

/** Modifikatorji iz modifiersJson — parse v try/catch, nikoli ne vrže */
function parseModifiers(modifiersJson: unknown): string[] {
  if (typeof modifiersJson !== 'string' || modifiersJson.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(modifiersJson)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((m) => (m && typeof m === 'object' && 'name' in m ? parseString((m as { name: unknown }).name) : null))
      .filter((n): n is string => n !== null)
  } catch {
    return []
  }
}

/** Grupiraj iteme naročila v CourseGroup po courseNumber ('Brez toka' zadnja) */
function groupCourses(items: CourseItem[]): CourseGroup[] {
  const groups = new Map<string, {
    courseNumber: number | null
    name: string
    courseId: string | null
    status: string | null
    items: CourseItem[]
  }>()

  for (const item of items) {
    const key = item.courseNumber === null ? 'none' : `cn:${item.courseNumber}`
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(item)
      // courseId/status: prvi znani (itemi istega toka si delijo Course vrstico)
      if (!existing.courseId && item.courseId) existing.courseId = item.courseId
      if (!existing.status && item.courseStatus) existing.status = item.courseStatus
      if (!existing.name && item.courseName) existing.name = item.courseName
    } else {
      groups.set(key, {
        courseNumber: item.courseNumber,
        name: item.courseNumber === null
          ? 'Brez toka'
          : (item.courseName || courseNameFor(item.courseNumber)),
        courseId: item.courseId,
        status: item.courseStatus,
        items: [item],
      })
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    // Toki po številki naraščajo; 'Brez toka' (null) vedno na koncu
    if (a.courseNumber === null && b.courseNumber === null) return 0
    if (a.courseNumber === null) return 1
    if (b.courseNumber === null) return -1
    return a.courseNumber - b.courseNumber
  })
}

export function useCoursePacing() {
  const query = useQuery({
    queryKey: queryKeys.kitchen.pacing,
    queryFn: async () => {
      const res = await authFetch('/api/kitchen')
      if (!res.ok) throw new Error(`Kitchen fetch failed (${res.status})`)
      const json: unknown = await res.json().catch(() => null)

      // Odgovor: { orders: [...] } — guard, nikoli ne vrže
      const rawOrders = json && typeof json === 'object' && 'orders' in json && Array.isArray((json as { orders: unknown }).orders)
        ? (json as { orders: unknown[] }).orders
        : []

      const pacedOrders: PacedOrder[] = []
      for (const rawOrder of rawOrders) {
        if (!rawOrder || typeof rawOrder !== 'object') continue
        const order = rawOrder as Record<string, unknown>
        const orderId = parseString(order.id)
        if (!orderId) continue

        const rawItems = Array.isArray(order.orderItems) ? order.orderItems : []
        const items: CourseItem[] = []
        for (const rawItem of rawItems) {
          if (!rawItem || typeof rawItem !== 'object') continue
          const it = rawItem as Record<string, unknown>
          const menuItem = it.menuItem && typeof it.menuItem === 'object' ? it.menuItem as Record<string, unknown> : null
          const courseNumber = parseCourseNumber(it.courseNumber)
          items.push({
            id: parseString(it.id) ?? '',
            name: parseString(menuItem?.name) ?? parseString(it.menuItemName) ?? '',
            quantity: typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1,
            modifiers: parseModifiers(it.modifiersJson),
            notes: parseString(it.notes) ?? '',
            status: parseItemStatus(it.status),
            courseNumber,
            courseName: parseString(it.courseName),
            courseStatus: parseString(it.courseStatus),
            courseId: parseString(it.courseId),
          })
        }

        const courses = groupCourses(items)
        // Naročila brez vsaj enega pravega toka niso del pacing pogleda
        if (!courses.some(c => c.courseNumber !== null)) continue

        const table = order.table && typeof order.table === 'object' ? order.table as Record<string, unknown> : null
        pacedOrders.push({
          id: orderId,
          orderNumber: typeof order.orderNumber === 'number' ? order.orderNumber : 0,
          tableNumber: typeof table?.number === 'number' ? table.number : null,
          tableName: parseString(table?.area),
          customerName: parseString(order.customerName) ?? '',
          orderType: parseString(order.type) ?? '',
          createdAt: parseString(order.createdAt),
          courses,
          hasPending: courses.some(c => c.status === 'pending'),
        })
      }

      return { pacedOrders }
    },
    refetchInterval: 5000,
  })

  const pacedOrders = query.data?.pacedOrders ?? []

  return {
    pacedOrders,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}

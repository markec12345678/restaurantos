// ============================================
// AI TOOLS — Default tool definitions
// ============================================
// Registrira osnovne tool-e, ki jih AI agent lahko kliče.
// ============================================

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import {
  registerTool,
  parseDateRangeFromPrompt,
  type ToolExecutionContext,
} from './index'

// --- 1. GET_REVENUE ---
registerTool(
  {
    name: 'get_revenue',
    description: 'Pridobi skupni promet za določeno obdobje',
    keywords: ['promet', 'prihodek', 'revenue', 'prodaja', 'zaslužek', 'znesek'],
    parameters: {
      dateFrom: { type: 'date', description: 'Začetni datum' },
      dateTo: { type: 'date', description: 'Končni datum' },
    },
  },
  async (params, context: ToolExecutionContext) => {
    const dateFrom = (params.dateFrom as Date) || context.dateFrom
    const dateTo = (params.dateTo as Date) || context.dateTo

    const orders = await db.order.findMany({
      where: {
        paidAt: { gte: dateFrom, lte: dateTo },
        paymentStatus: 'paid',
      },
      select: { total: true, tip: true },
    })

    const totalRevenue = orders.reduce((sum, o) => sum + toNum(o.total), 0)
    const totalTips = orders.reduce((sum, o) => sum + toNum(o.tip), 0)

    return {
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalTips: Math.round(totalTips * 100) / 100,
        orderCount: orders.length,
        avgOrderValue: orders.length > 0 ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
      },
      format: 'number',
      metadata: { rowCount: 1 },
    }
  },
)

// --- 2. GET_TOP_ITEMS ---
registerTool(
  {
    name: 'get_top_items',
    description: 'Pridobi najbolj prodajane artikle',
    keywords: ['top', 'najbolj', 'priljubljen', 'popular', 'artikel', 'jed', 'prodajan'],
    parameters: {
      dateFrom: { type: 'date' },
      dateTo: { type: 'date' },
      limit: { type: 'number', default: 10 },
    },
  },
  async (params, context: ToolExecutionContext) => {
    const dateFrom = (params.dateFrom as Date) || context.dateFrom
    const dateTo = (params.dateTo as Date) || context.dateTo
    const limit = (params.limit as number) || 10

    const items = await db.orderItem.findMany({
      where: {
        voided: false,
        order: {
          paidAt: { gte: dateFrom, lte: dateTo },
          paymentStatus: 'paid',
        },
      },
      select: {
        menuItemId: true,
        quantity: true,
        price: true,
        menuItemName: true,
      },
    })

    // Agregiraj
    const aggregated: Record<string, { name: string; quantity: number; revenue: number }> = {}
    for (const item of items) {
      const key = item.menuItemId
      if (!aggregated[key]) {
        aggregated[key] = { name: item.menuItemName || 'Neznan', quantity: 0, revenue: 0 }
      }
      aggregated[key].quantity += item.quantity
      aggregated[key].revenue += toNum(item.price) * item.quantity
    }

    const topItems = Object.values(aggregated)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit)
      .map((item) => ({
        ...item,
        revenue: Math.round(item.revenue * 100) / 100,
      }))

    return {
      success: true,
      data: topItems,
      format: 'table',
      metadata: { rowCount: topItems.length },
    }
  },
)

// --- 3. GET_ORDER_COUNT ---
registerTool(
  {
    name: 'get_order_count',
    description: 'Število naročil v določenem obdobju',
    keywords: ['število', 'koliko', 'stevilo', 'count', 'naročil', 'narocil'],
    parameters: {
      dateFrom: { type: 'date' },
      dateTo: { type: 'date' },
    },
  },
  async (params, context: ToolExecutionContext) => {
    const dateFrom = (params.dateFrom as Date) || context.dateFrom
    const dateTo = (params.dateTo as Date) || context.dateTo

    const count = await db.order.count({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
        paymentStatus: 'paid',
      },
    })

    return {
      success: true,
      data: { count, dateFrom: dateFrom?.toISOString(), dateTo: dateTo?.toISOString() },
      format: 'number',
      metadata: { rowCount: 1 },
    }
  },
)

// --- 4. GET_PEAK_HOURS ---
registerTool(
  {
    name: 'get_peak_hours',
    description: 'Analiza prometnih ur (kdaj je največ naročil)',
    keywords: ['ura', 'peak', 'prometne', 'zaseden', 'ure', 'hour'],
    parameters: {
      dateFrom: { type: 'date' },
      dateTo: { type: 'date' },
    },
  },
  async (params, context: ToolExecutionContext) => {
    const dateFrom = (params.dateFrom as Date) || context.dateFrom
    const dateTo = (params.dateTo as Date) || context.dateTo

    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
        paymentStatus: 'paid',
      },
      select: { createdAt: true },
    })

    // Agregiraj po urah
    const hourlyData: Array<{ hour: number; count: number }> = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours()
      hourlyData[hour].count++
    }

    // Sortiraj po count desc
    const sorted = [...hourlyData].sort((a, b) => b.count - a.count)

    return {
      success: true,
      data: {
        hourly: hourlyData,
        peakHours: sorted.slice(0, 5),
        totalOrders: orders.length,
      },
      format: 'chart',
      metadata: { rowCount: 24 },
    }
  },
)

// --- 5. CHECK_FRAUD (admin only) ---
registerTool(
  {
    name: 'check_fraud',
    description: 'Preveri sumljive aktivnosti (fraud, anomalije)',
    keywords: ['fraud', 'sumljiv', 'anomalija', 'suspicious', 'nepravilnost', 'kraja', 'manipulacija'],
    adminOnly: true,
    parameters: {
      dateFrom: { type: 'date' },
      dateTo: { type: 'date' },
    },
  },
  async (params, context: ToolExecutionContext) => {
    const dateFrom = (params.dateFrom as Date) || context.dateFrom
    const dateTo = (params.dateTo as Date) || context.dateTo

    // Dynamic import, da se izognemo circular dependency
    const { runAllFraudChecks } = await import('@/lib/fraud-detection')
    const result = await runAllFraudChecks(undefined, dateFrom, dateTo)

    return {
      success: true,
      data: result,
      format: 'table',
      metadata: { rowCount: result.alerts.length },
    }
  },
)

// --- 6. GET_EMPLOYEE_PERFORMANCE ---
registerTool(
  {
    name: 'get_employee_performance',
    description: 'Analiza performance zaposlenih',
    keywords: ['zaposlen', 'employee', 'performance', 'natakar', 'kuhar', 'prodaja'],
    parameters: {
      dateFrom: { type: 'date' },
      dateTo: { type: 'date' },
    },
  },
  async (params, context: ToolExecutionContext) => {
    const dateFrom = (params.dateFrom as Date) || context.dateFrom
    const dateTo = (params.dateTo as Date) || context.dateTo

    const orders = await db.order.findMany({
      where: {
        paidAt: { gte: dateFrom, lte: dateTo },
        paymentStatus: 'paid',
        employeeId: { not: null },
      },
      select: {
        employeeId: true,
        total: true,
        tip: true,
      },
    })

    // Agregiraj po employee
    const byEmployee: Record<string, { revenue: number; tips: number; orderCount: number }> = {}
    for (const order of orders) {
      const empId = order.employeeId!
      if (!byEmployee[empId]) byEmployee[empId] = { revenue: 0, tips: 0, orderCount: 0 }
      byEmployee[empId].revenue += toNum(order.total)
      byEmployee[empId].tips += toNum(order.tip)
      byEmployee[empId].orderCount++
    }

    // Pridobi imena
    const employeeIds = Object.keys(byEmployee)
    const employees = await db.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true },
    })

    const result = Object.entries(byEmployee)
      .map(([empId, data]) => ({
        employeeId: empId,
        name: employees.find((e) => e.id === empId)?.name || 'Neznan',
        revenue: Math.round(data.revenue * 100) / 100,
        tips: Math.round(data.tips * 100) / 100,
        orderCount: data.orderCount,
        avgOrderValue: data.orderCount > 0 ? Math.round((data.revenue / data.orderCount) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return {
      success: true,
      data: result,
      format: 'table',
      metadata: { rowCount: result.length },
    }
  },
)

// --- Export helper za AI agent ---
export { parseDateRangeFromPrompt }

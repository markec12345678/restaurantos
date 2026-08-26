// ============================================
// ODZIVNA SHEMA — Dashboard (GET /api/dashboard)
// Varnostna validacija odziva za ključno API ruto
// ============================================

import { z } from 'zod'

export const dashboardResponseSchema = z.object({
  // Osnovne finance
  todayRevenue: z.number(),
  todayTips: z.number(),
  todayTax: z.number(),
  todayDiscount: z.number(),
  // Štetja naročil
  totalOrders: z.number(),
  completedOrders: z.number(),
  cancelledOrders: z.number(),
  pendingOrders: z.number(),
  inProgressOrders: z.number(),
  readyOrders: z.number(),
  avgOrderValue: z.number(),
  // Mize
  activeTables: z.number(),
  totalTables: z.number(),
  // Zaloga
  lowStockItems: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    minQuantity: z.number(),
    unit: z.string().nullable(),
  })),
  // Zadnja naročila ( kompleksna Prisma struktura — dovoljeno kot array objektov)
  recentOrders: z.array(z.unknown()),
  // Dnevni prihodki
  dailyRevenue: z.array(z.object({
    date: z.string(),
    revenue: z.number(),
  })),
  // Analitika
  categoryBreakdown: z.array(z.object({
    name: z.string(),
    revenue: z.number(),
    count: z.number(),
  })),
  hourlyRevenue: z.array(z.object({
    hour: z.number(),
    label: z.string(),
    revenue: z.number(),
  })),
  vatBreakdown: z.array(z.object({
    rate: z.string(),
    base: z.number(),
    vat: z.number(),
  })),
  paymentMethodBreakdown: z.array(z.object({
    method: z.string(),
    total: z.number(),
  })),
  orderTypeBreakdown: z.array(z.object({
    type: z.string(),
    revenue: z.number(),
    count: z.number(),
  })),
  topSellingItems: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    revenue: z.number(),
  })),
  employeePerformance: z.array(z.object({
    name: z.string(),
    orders: z.number(),
    revenue: z.number(),
  })),
  avgWaitMinutes: z.number(),
  // FURS & Blagajna
  fursStatus: z.object({
    configured: z.boolean(),
    environment: z.string(),
    todayVerified: z.number(),
    todayUnverified: z.number(),
  }),
  activeShift: z.object({
    id: z.string(),
    openedAt: z.string(), // ISO datumski niz po JSON serializaciji
    startingCash: z.number(),
    cashSales: z.number(),
    cardSales: z.number(),
    totalSales: z.number(),
    totalOrders: z.number(),
  }).nullable(),
  // Stroški
  todayCogs: z.number(),
  grossProfit: z.number(),
  grossMargin: z.number(),
  // Napredna analitika — WoW primerjava
  wowComparison: z.object({
    thisWeek: z.object({
      revenue: z.number(),
      orders: z.number(),
      avgOrder: z.number(),
    }),
    lastWeek: z.object({
      revenue: z.number(),
      orders: z.number(),
      avgOrder: z.number(),
    }),
    changes: z.object({
      revenue: z.number(),
      orders: z.number(),
      avgOrder: z.number(),
    }),
    thisWeekDaily: z.array(z.object({
      date: z.string(),
      revenue: z.number(),
      orders: z.number(),
    })),
    lastWeekDaily: z.array(z.object({
      date: z.string(),
      revenue: z.number(),
      orders: z.number(),
    })),
  }),
  // Toplotni zemljevid
  heatmapData: z.array(z.object({
    day: z.number(),
    hour: z.number(),
    revenue: z.number(),
    orders: z.number(),
  })),
  // Gostje
  guestAnalytics: z.object({
    totalGuests: z.number(),
    repeatGuests: z.number(),
    guestReturnRate: z.number(),
  }),
})

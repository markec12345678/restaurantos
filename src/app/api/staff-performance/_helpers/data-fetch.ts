// Podatkovne poizvedbe za kadrovsko analitiko

import { db } from '@/lib/db'

export async function fetchPerformanceData(startDate: Date, locationId: string | null) {
  const loc = locationId ? { locationId } : {}
  return Promise.all([
    db.employee.findMany({
      where: { status: 'active', ...loc },
      select: { id: true, name: true, role: true, jobs: { select: { job: { select: { name: true } } } } },
    }),
    db.order.groupBy({
      by: ['employeeId'],
      where: { status: 'completed', createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      _sum: { total: true }, _count: true,
    }),
    db.order.groupBy({
      by: ['employeeId'],
      where: { createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      _count: true,
    }),
    db.order.groupBy({
      by: ['employeeId'],
      where: { status: 'cancelled', createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      _count: true,
    }),
    db.order.groupBy({
      by: ['employeeId', 'type'],
      where: { status: 'completed', createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      _count: true,
    }),
    db.order.groupBy({
      by: ['employeeId', 'tableId'],
      where: { status: 'completed', createdAt: { gte: startDate }, employeeId: { not: null }, tableId: { not: null }, ...loc },
    }),
    db.payment.groupBy({
      by: ['employeeId'],
      where: { createdAt: { gte: startDate }, employeeId: { not: null } },
      _sum: { tipAmount: true },
    }),
    db.staffShift.groupBy({
      by: ['employeeId'],
      where: { shiftDate: { gte: startDate }, status: { notIn: ['cancelled'] }, ...loc },
      _count: true,
    }),
    db.timeEntry.groupBy({
      by: ['employeeId'],
      where: { clockIn: { gte: startDate }, clockOut: { not: null } },
      _sum: { totalMinutes: true },
    }),
    db.order.findMany({
      where: { status: 'completed', createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      select: { employeeId: true, createdAt: true, updatedAt: true },
    }),
    db.order.findMany({
      where: { createdAt: { gte: startDate }, employeeId: { not: null }, orderItems: { some: { modifiersJson: { not: '[]' } } }, ...loc },
      select: { employeeId: true },
    }),
  ])
}

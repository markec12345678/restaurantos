// ─── GET helper: Pridobi rezervacije s povzetkom ───

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function handleGetReservations(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || ''
  const status = searchParams.get('status') || ''
  const upcoming = searchParams.get('upcoming') === 'true'
  // FIX MEDIUM: Paginacija za rezervacije z NaN varnostjo
  const rawLimit = parseInt(searchParams.get('limit') || '100')
  const rawOffset = parseInt(searchParams.get('offset') || '0')
  const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
  const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

  const where: Record<string, unknown> = {}

  if (status) {
    where.status = status
  }

  if (date) {
    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)
    where.dateTime = { gte: startDate, lte: endDate }
  } else if (upcoming) {
    // Prihajajoče rezervacije (od danes naprej)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    where.dateTime = { gte: now }
    where.status = { in: ['confirmed', 'seated'] }
  }

  const [reservations, totalCount] = await Promise.all([
    db.reservation.findMany({
      where,
      include: {
        table: { select: { id: true, number: true, capacity: true, area: true } },
      },
      orderBy: { dateTime: 'asc' },
      take: limit,
      skip: offset,
    }),
    db.reservation.count({ where }),
  ])

  // FIX MEDIUM: Summary mora odražati VSE rezervacije, ne samo trenutno stran
  const statusCounts = await db.reservation.groupBy({
    by: ['status'],
    where,
    _count: true,
  })
  const statusMap = Object.fromEntries(statusCounts.map(s => [s.status, s._count]))
  const allGuestsResult = await db.reservation.aggregate({
    where: { ...where, status: { notIn: ['cancelled'] } },
    _sum: { partySize: true },
  })

  const summary = {
    total: totalCount,
    confirmed: statusMap['confirmed'] || 0,
    seated: statusMap['seated'] || 0,
    cancelled: statusMap['cancelled'] || 0,
    noShow: statusMap['no_show'] || 0,
    totalGuests: allGuestsResult._sum.partySize || 0,
  }

  return NextResponse.json({
    reservations,
    date: date || new Date().toISOString().split('T')[0],
    summary,
  })
}

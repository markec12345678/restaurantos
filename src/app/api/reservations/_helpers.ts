// Pomožne funkcije za rezervacijski API

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { emitEvent } from '@/lib/event-emitter'

// ─── GET helper: Pridobi rezervacije s povzetkom ───

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

// ─── POST helper: Ustvari rezervacijo ───

export async function handleCreateReservation(
  data: {
    tableId?: string | null
    dateTime: string
    partySize: number
    duration: number
    customerName: string
    customerPhone?: string
    customerEmail?: string
    notes?: string
    specialRequests?: string
    source?: string
  },
  employeeId: string | undefined,
) {
  // Preveri, da miza obstaja in je primerne velikosti
  if (data.tableId) {
    const table = await db.table.findUnique({ where: { id: data.tableId } })
    if (!table) {
      return { error: 'Miza ne obstaja', status: 404 }
    }
    if (table.capacity < data.partySize) {
      return { error: `Miza ${table.number} ima kapaciteto ${table.capacity}, premajhna za ${data.partySize} oseb`, status: 400 }
    }

    // Preveri konflikte — ali je miza že rezervirana v tem času?
    const reservationStart = new Date(data.dateTime)
    const reservationEnd = new Date(reservationStart.getTime() + data.duration * 60000)

    const existingReservations = await db.reservation.findMany({
      where: {
        tableId: data.tableId,
        status: { in: ['confirmed', 'seated'] },
      },
    })

    for (const existing of existingReservations) {
      const existingStart = new Date(existing.dateTime)
      const existingEnd = new Date(existingStart.getTime() + (existing.duration || 120) * 60000)
      if (reservationStart < existingEnd && reservationEnd > existingStart) {
        return { error: `Miza ${table.number} je že rezervirana ob ${existingStart.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}`, status: 409 }
      }
    }
  }

  // Ustvari rezervacijo
  const reservation = await db.reservation.create({
    data: {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      tableId: data.tableId || null,
      dateTime: new Date(data.dateTime),
      partySize: data.partySize,
      duration: data.duration,
      status: 'confirmed',
      notes: data.notes,
      specialRequests: data.specialRequests,
      source: data.source,
      confirmedAt: new Date(),
      employeeId: employeeId || null,
    },
    include: {
      table: { select: { id: true, number: true, capacity: true, area: true } },
    },
  })

  // Audit log
  await createAuditLog({
    userId: employeeId,
    action: 'CREATE_RESERVATION',
    entityType: 'Reservation',
    entityId: reservation.id,
    details: {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      tableId: data.tableId,
      dateTime: data.dateTime,
      partySize: data.partySize,
    },
  })

  // Webhook: reservation.created
  emitEvent('reservation.created', {
    reservationId: reservation.id,
    customerName: data.customerName,
    dateTime: data.dateTime,
    partySize: data.partySize,
  }).catch(err => logger.error('API', '[Webhook] reservation.created napaka:', err))

  return { reservation }
}

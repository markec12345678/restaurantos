// ============================================
// REZERVACIJSKI SISTEM — Profesionalna implementacija
// Uporablja Reservation model iz Prisma sheme
// Toast POS + TouchBistro standard
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================
// GET - Pridobi rezervacije
// ============================================

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || ''
    const status = searchParams.get('status') || ''
    const upcoming = searchParams.get('upcoming') === 'true'

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

    const reservations = await db.reservation.findMany({
      where,
      include: {
        table: { select: { id: true, number: true, capacity: true, area: true } },
      },
      orderBy: { dateTime: 'asc' },
    })

    // Povzetek
    const summary = {
      total: reservations.length,
      confirmed: reservations.filter(r => r.status === 'confirmed').length,
      seated: reservations.filter(r => r.status === 'seated').length,
      cancelled: reservations.filter(r => r.status === 'cancelled').length,
      noShow: reservations.filter(r => r.status === 'no_show').length,
      totalGuests: reservations.filter(r => r.status !== 'cancelled').reduce((sum, r) => sum + r.partySize, 0),
    }

    return NextResponse.json({
      reservations,
      date: date || new Date().toISOString().split('T')[0],
      summary,
    })
  } catch (error) {
    console.error('Napaka pri pridobivanju rezervacij:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju rezervacij' }, { status: 500 })
  }
}

// ============================================
// POST - Ustvari rezervacijo
// ============================================

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      customerName,
      customerPhone,
      customerEmail,
      tableId,
      dateTime,
      partySize,
      duration,
      notes,
      specialRequests,
      source,
    } = body

    // Validacija
    if (!customerName || !dateTime || !partySize) {
      return NextResponse.json(
        { error: 'Ime stranke, datum/čas in število oseb so obvezni' },
        { status: 400 }
      )
    }

    // Preveri, da miza obstaja in je primerne velikosti
    if (tableId) {
      const table = await db.table.findUnique({ where: { id: tableId } })
      if (!table) {
        return NextResponse.json({ error: 'Miza ne obstaja' }, { status: 404 })
      }
      if (table.capacity < partySize) {
        return NextResponse.json(
          { error: `Miza ${table.number} ima kapaciteto ${table.capacity}, premajhna za ${partySize} oseb` },
          { status: 400 }
        )
      }

      // Preveri konflikte — ali je miza že rezervirana v tem času?
      const reservationStart = new Date(dateTime)
      const reservationEnd = new Date(reservationStart.getTime() + (duration || 120) * 60000)

      const conflicting = await db.reservation.findFirst({
        where: {
          tableId,
          status: { in: ['confirmed', 'seated'] },
          dateTime: { lt: reservationEnd },
          // Konec rezervacije = dateTime + duration
          // Konflikt če: novi_start < obstoječi_konec AND novi_konec > obstoječi_start
        },
      })

      // Preprosta preveritev — za natančno bi morali računati konec obstoječe rezervacije
      if (conflicting) {
        const conflictEnd = new Date(new Date(conflicting.dateTime).getTime() + (conflicting.duration || 120) * 60000)
        if (reservationStart < conflictEnd && reservationEnd > new Date(conflicting.dateTime)) {
          return NextResponse.json(
            { error: `Miza ${table.number} je že rezervirana ob ${new Date(conflicting.dateTime).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}` },
            { status: 409 }
          )
        }
      }
    }

    // Ustvari rezervacijo
    const reservation = await db.reservation.create({
      data: {
        customerName,
        customerPhone: customerPhone || '',
        customerEmail: customerEmail || '',
        tableId: tableId || null,
        dateTime: new Date(dateTime),
        partySize,
        duration: duration || 120,
        status: 'confirmed',
        notes: notes || '',
        specialRequests: specialRequests || '',
        source: source || 'walk_in',
        confirmedAt: new Date(),
      },
      include: {
        table: { select: { id: true, number: true, capacity: true, area: true } },
      },
    })

    // Audit log
    await createAuditLog({
      action: 'CREATE_RESERVATION',
      entityType: 'Reservation',
      entityId: reservation.id,
      details: {
        customerName,
        customerPhone,
        tableId,
        dateTime,
        partySize,
        notes,
      },
    })

    return NextResponse.json({ success: true, reservation }, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju rezervacije:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju rezervacije' }, { status: 500 })
  }
}

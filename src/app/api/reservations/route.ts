// ============================================
// REZERVACIJSKI SISTEM — Profesionalna implementacija
// Uporablja Reservation model iz Prisma sheme
// Toast POS + TouchBistro standard
// Avtentikacija + Zod validacija
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createReservationSchema } from '@/lib/validations'

// ============================================
// GET - Pridobi rezervacije
// ============================================

export async function GET(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za vpogled v rezervacije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || ''
    const status = searchParams.get('status') || ''
    const upcoming = searchParams.get('upcoming') === 'true'
    // FIX MEDIUM: Paginacija za rezervacije
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

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
      take: limit,
      skip: offset,
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
    // FIX C-05: Zahtevaj avtentikacijo za ustvarjanje rezervacije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Zod validacija namesto ročne
    const { data, error: validationError } = validateBody(createReservationSchema, body)
    if (validationError) return validationError

    // Preveri, da miza obstaja in je primerne velikosti
    if (data.tableId) {
      const table = await db.table.findUnique({ where: { id: data.tableId } })
      if (!table) {
        return NextResponse.json({ error: 'Miza ne obstaja' }, { status: 404 })
      }
      if (table.capacity < data.partySize) {
        return NextResponse.json(
          { error: `Miza ${table.number} ima kapaciteto ${table.capacity}, premajhna za ${data.partySize} oseb` },
          { status: 400 }
        )
      }

      // Preveri konflikte — ali je miza že rezervirana v tem času?
      // FIX: Two reservations conflict if: newStart < existingEnd AND newEnd > existingStart
      const reservationStart = new Date(data.dateTime)
      const reservationEnd = new Date(reservationStart.getTime() + data.duration * 60000)

      // Pridobi VSE aktivne rezervacije za to mizo in preveri prekrivanje v pomnilniku
      // SQLite ne podpira kompleksnih datumskih poizvedb z izračuni
      const existingReservations = await db.reservation.findMany({
        where: {
          tableId: data.tableId,
          status: { in: ['confirmed', 'seated'] },
        },
      })

      for (const existing of existingReservations) {
        const existingStart = new Date(existing.dateTime)
        const existingEnd = new Date(existingStart.getTime() + (existing.duration || 120) * 60000)
        // Prekrivanje: newStart < existingEnd AND newEnd > existingStart
        if (reservationStart < existingEnd && reservationEnd > existingStart) {
          return NextResponse.json(
            { error: `Miza ${table.number} je že rezervirana ob ${existingStart.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}` },
            { status: 409 }
          )
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
        employeeId: authResult.session?.employeeId || null,
      },
      include: {
        table: { select: { id: true, number: true, capacity: true, area: true } },
      },
    })

    // Audit log
    await createAuditLog({
      userId: authResult.session?.employeeId,
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

    return NextResponse.json({ success: true, reservation }, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju rezervacije:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju rezervacije' }, { status: 500 })
  }
}

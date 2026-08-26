// Pomožne funkcije za mize in restavracijski status

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ─── Preveri, ali je restavracija odprta ───
export async function isRestaurantOpen(): Promise<boolean> {
  try {
    const hours = await db.openingHours.findMany({ where: {} })
    if (!hours || hours.length === 0) return false
    // FIX MEDIUM: Uporabi slovenski čas (CET/CEST), ne strežnikov lokalni čas
    const slovenianTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Ljubljana' })
    const now = new Date(slovenianTime)
    const dayOfWeek = now.getDay()
    const todayHours = hours.find(h => h.dayOfWeek === dayOfWeek)
    if (!todayHours || todayHours.isClosed) return false

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (todayHours.openTime && currentTime < todayHours.openTime) return false
    if (todayHours.closeTime && currentTime > todayHours.closeTime) return false
    return true
  } catch {
    return false
  }
}

// ─── Poišči mizo — podprto prek tableNumber (int) ali tableId (UUID) ───
export interface ResolvedTable {
  tableId: string | undefined
  tableNumber: number | undefined
}

export async function resolveTable(
  tableId?: string,
  tableNumber?: string | number,
): Promise<ResolvedTable | NextResponse> {
  if (tableId) {
    // QR /qr/[tableId] pošilja UUID tableId
    const table = await db.table.findUnique({ where: { id: tableId } })
    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena. Skennirajte QR kodo na mizi.' }, { status: 400 })
    }
    // FIX BUG-15: Preveri stanje mize pred oznako 'occupied'
    if (table.status === 'available' || table.status === 'occupied') {
      await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
    }
    return { tableId: table.id, tableNumber: table.number }
  }

  if (tableNumber) {
    const tableNum = parseInt(String(tableNumber), 10)
    if (isNaN(tableNum) || tableNum < 1 || tableNum > 999) {
      return NextResponse.json({ error: 'Neveljavna številka mize' }, { status: 400 })
    }
    const table = await db.table.findFirst({ where: { number: tableNum } })
    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena. Obvestite natakarja.' }, { status: 400 })
    }
    // FIX BUG-15: Preveri stanje mize pred oznako 'occupied'
    if (table.status === 'available' || table.status === 'occupied') {
      await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
    }
    return { tableId: table.id, tableNumber: tableNum }
  }

  return { tableId: undefined, tableNumber: undefined }
}

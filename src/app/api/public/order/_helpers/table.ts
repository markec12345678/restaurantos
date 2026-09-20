// Pomožne funkcije za mize in restavracijski status

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ─── Preveri, ali je restavracija odprta ───
// R83: locationId parameter — prej globalni findMany({}) je MEŠAL urnike
// vseh tenantov (urnik lokacije A je odpiral/zapiral QR naročanje lokacije B).
// Brez locationId: false (fail-closed — klicatelj mora znati svojo lokacijo).
export async function isRestaurantOpen(locationId?: string | null): Promise<boolean> {
  try {
    if (!locationId) return false
    const hours = await db.openingHours.findMany({ where: { locationId } })
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
  // WS AUDIT 2026-09-09: lokacija mize — za per-location WS dostavo NEW_ORDER
  locationId?: string | null
}

export async function resolveTable(
  tableId?: string,
  tableNumber?: string | number,
  // R83: lokacijski kontekst za tableNumber disambiguacijo (per-lokacijski števec)
  locationId?: string | null,
  // R83-FIX (M1): obvezateljski write je ločen — prej je bila miza označena
  // 'occupied' ŠE PRED isOpen 403 (fantomske zasedene mize ob zaprti restavraciji)
  options?: { markOccupied?: boolean },
): Promise<ResolvedTable | NextResponse> {
  const markOccupied = options?.markOccupied !== false
  if (tableId) {
    // QR /qr/[tableId] pošilja UUID tableId
    const table = await db.table.findUnique({ where: { id: tableId } })
    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena. Skennirajte QR kodo na mizi.' }, { status: 400 })
    }
    // FIX BUG-15: Preveri stanje mize pred oznako 'occupied'
    if (markOccupied && (table.status === 'available' || table.status === 'occupied')) {
      await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
    }
    return { tableId: table.id, tableNumber: table.number, locationId: table.locationId ?? null }
  }

  if (tableNumber) {
    const tableNum = parseInt(String(tableNumber), 10)
    if (isNaN(tableNum) || tableNum < 1 || tableNum > 999) {
      return NextResponse.json({ error: 'Neveljavna številka mize' }, { status: 400 })
    }
    // R84 FIX (M2, fail-closed): tableNumber BREZ locationId → 400. Prej je bil
    // findFirst GLOBALEN (prvi zadetek čez vse tenant-e) — prvi tenant z mizo
    // št. N je dobil TUJE naročilo + 'occupied' write. tableId (QR UUID) pot
    // ostane brez omejitev; tableNumber zahteva ekspliciten lokacijski kontekst.
    if (!locationId) {
      return NextResponse.json(
        { error: 'Manjka lokacijski kontekst za številko mize — skenirajte QR kodo na mizi.' },
        { status: 400 },
      )
    }
    const table = await db.table.findFirst({
      where: { number: tableNum, locationId },
    })
    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena. Obvestite natakarja.' }, { status: 400 })
    }
    // FIX BUG-15: Preveri stanje mize pred oznako 'occupied'
    if (markOccupied && (table.status === 'available' || table.status === 'occupied')) {
      await db.table.update({ where: { id: table.id }, data: { status: 'occupied' } })
    }
    return { tableId: table.id, tableNumber: tableNum, locationId: table.locationId ?? null }
  }

  return { tableId: undefined, tableNumber: undefined }
}

// R83-FIX (M1): označi mizo zasedeno ŠELE po uspešnih gate-ih (isOpen, artikli)
export async function markTableOccupied(tableId: string): Promise<void> {
  await db.table.update({ where: { id: tableId }, data: { status: 'occupied' } })
}

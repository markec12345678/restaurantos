// ============================================
// GUEST VISIT HASH CHAIN — Transakcijsko varna pomožna funkcija
// ============================================
//
// Schema (prisma/schema.prisma:1479) deklarira previousHash + chainHash
// stolpce na GuestVisit z komentarjem "FIX F5-8: Kriptografska zaščita
// (hash chain) — EU 852/2004", a koda jih prej NI nikoli nastavila.
//
// Ta modul implementira transakcijsko varno pisanje z hash verigo (enak
// pattern kot createAuditLog, createHaccpEntryWithChain in
// createTipDistributionWithChain).
//

import crypto from 'crypto'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export interface GuestVisitChainEntry {
  guestId: string
  orderId?: string | null
  tableId?: string | null
  partySize: number
  totalSpent: number
  tipAmount: number
  feedbackScore?: number | null
  feedbackComment?: string
  employeeId?: string | null
  employeeName: string
  arrivedAt?: Date
  departedAt?: Date | null
  durationMinutes?: number
}

/**
 * Ustvari GuestVisit z hash verigo ZNOTRAJ transakcije.
 *
 * Uporaba:
 *   const visit = await createGuestVisitWithChain({
 *     guestId: 'cuid...',
 *     partySize: 4,
 *     totalSpent: 120.50,
 *     tipAmount: 12.00,
 *     employeeName: 'Janez',
 *     arrivedAt: new Date(),
 *   })
 */
export async function createGuestVisitWithChain(entry: GuestVisitChainEntry) {
  return db.$transaction(async (tx) => {
    // Pridobi zadnji chainHash ZNOTRAJ transakcije
    const lastEntry = await tx.guestVisit.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { chainHash: true },
    })
    const previousHash = lastEntry?.chainHash || ''

    const arrivedAt = entry.arrivedAt || new Date()
    // Hash payload po schemi: previousHash + title + value + status + date
    // Za GuestVisit: title = employeeName, value = totalSpent, status = 'visited', date = arrivedAt
    const hashPayload = [
      previousHash,
      entry.employeeName,
      entry.totalSpent.toFixed(2),
      'visited',
      arrivedAt.toISOString(),
    ].join('|')
    const chainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

    return tx.guestVisit.create({
      data: {
        guestId: entry.guestId,
        orderId: entry.orderId || null,
        tableId: entry.tableId || null,
        partySize: entry.partySize,
        totalSpent: entry.totalSpent,
        tipAmount: entry.tipAmount,
        feedbackScore: entry.feedbackScore || null,
        feedbackComment: entry.feedbackComment || '',
        employeeId: entry.employeeId || null,
        employeeName: entry.employeeName,
        arrivedAt,
        departedAt: entry.departedAt || null,
        durationMinutes: entry.durationMinutes || 0,
        previousHash,
        chainHash,
      },
    })
  })
}

/**
 * Verificiraj integriteto GuestVisit verige.
 * Vrne prvi vnos, kjer je veriga prelomljena (ali null če je OK).
 */
export async function verifyGuestVisitChainIntegrity(): Promise<{ id: string; employeeName: string } | null> {
  try {
    const entries = await db.guestVisit.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, employeeName: true, totalSpent: true, arrivedAt: true, previousHash: true, chainHash: true },
      take: 10000,
    })

    let expectedPrevious = ''
    for (const entry of entries) {
      if (entry.previousHash !== expectedPrevious) {
        return { id: entry.id, employeeName: entry.employeeName }
      }
      const dateIso = entry.arrivedAt instanceof Date ? entry.arrivedAt.toISOString() : String(entry.arrivedAt)
      const hashPayload = [
        entry.previousHash,
        entry.employeeName,
        entry.totalSpent.toString(),
        'visited',
        dateIso,
      ].join('|')
      const expectedChainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')
      if (entry.chainHash !== expectedChainHash) {
        return { id: entry.id, employeeName: entry.employeeName }
      }
      expectedPrevious = entry.chainHash
    }
    return null
  } catch (error: unknown) {
    logger.error('GUEST_VISIT', 'Napaka pri preverjanju integritete verige:', error)
    return null
  }
}

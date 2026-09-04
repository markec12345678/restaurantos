// ============================================
// HACCP HASH CHAIN — Transakcijsko varna pomožna funkcija
// ============================================
//
// EU 852/2004 zahteva nepopravljivo evidenco HACCP vnosev. Hash veriga
// (previousHash + chainHash = SHA-256) zagotavlja tamper-evidence:
// če kdo spremeni zgodovinski vnos, se veriga prelomi.
//
// FIX CRITICAL: Prejšnja implementacija je brala `lastEntry.chainHash`
// OUTSIDE transakcije — dva sočasna klica (natakar + IoT senzor) bi
// prebrala isti previousHash in ustvarila RAZVEJANO verigo, kar
// uniči tamper-evidence jamstvo.
//
// Ta implementacija uporablja `db.$transaction` z read+write znotraj
// iste transakcije — kopira pattern iz `createAuditLog()` v `src/lib/db.ts`.
//

import crypto from 'crypto'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export interface HaccpChainEntry {
  date: Date
  category: string
  title: string
  description?: string
  value: string
  status: 'ok' | 'warning' | 'critical' | 'archived'
  correctiveAction?: string
  employeeName: string
}

/**
 * Ustvari HACCP vnos s hash verigo ZNOTRAJ transakcije.
 *
 * Uporaba:
 *   const entry = await createHaccpEntryWithChain({
 *     date: new Date(),
 *     category: 'temperature',
 *     title: 'Hladilnik 1',
 *     value: '3.2°C',
 *     status: 'ok',
 *     employeeName: 'IoT Auto',
 *   })
 */
export async function createHaccpEntryWithChain(entry: HaccpChainEntry) {
  return db.$transaction(async (tx) => {
    // Pridobi zadnji chainHash ZNOTRAJ transakcije — prepreči race condition
    const lastEntry = await tx.haccpEntry.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { chainHash: true },
    })
    const previousHash = lastEntry?.chainHash || ''

    const hashPayload = [
      previousHash,
      entry.title,
      entry.value,
      entry.status,
      entry.date.toISOString(),
    ].join('|')
    const chainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

    return tx.haccpEntry.create({
      data: {
        date: entry.date,
        category: entry.category,
        title: entry.title,
        description: entry.description || '',
        value: entry.value,
        status: entry.status,
        correctiveAction: entry.correctiveAction || '',
        employeeName: entry.employeeName,
        previousHash,
        chainHash,
      },
    })
  })
}

/**
 * Verificiraj integriteto HACCP verige — vrne prvo mesto preloma (ali null).
 *
 * Uporaba:
 *   const broken = await verifyHaccpChainIntegrity()
 *   if (broken) logger.error('HACCP', 'Veriga prelomljena pri:', broken)
 */
export async function verifyHaccpChainIntegrity(): Promise<{ id: string; title: string; date: Date } | null> {
  try {
    const entries = await db.haccpEntry.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, value: true, status: true, date: true, previousHash: true, chainHash: true },
      take: 10000,
    })

    let expectedPrevious = ''
    for (const entry of entries) {
      if (entry.previousHash !== expectedPrevious) {
        return { id: entry.id, title: entry.title, date: entry.date }
      }
      const hashPayload = [entry.previousHash, entry.title, entry.value, entry.status, entry.date.toISOString()].join('|')
      const expectedChainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')
      if (entry.chainHash !== expectedChainHash) {
        return { id: entry.id, title: entry.title, date: entry.date }
      }
      expectedPrevious = entry.chainHash
    }
    return null
  } catch (error: unknown) {
    logger.error('HACCP', 'Napaka pri preverjanju integritete verige:', error)
    return null
  }
}

// ============================================
// TIP DISTRIBUTION HASH CHAIN — Transakcijsko varna pomožna funkcija
// ============================================
//
// Schema (prisma/schema.prisma:2067) deklarira `previousHash` + `chainHash`
// stolpce na TipDistribution z komentarjem "FIX F5-8: Kriptografska zaščita
// (hash chain) — EU 852/2004", a koda jih NIKOLI ni nastavila — vedno so
// ostali prazni "".
//
// Ta modul implementira transakcijsko varno pisanje z hash verigo (podobno
// kot `createAuditLog` v src/lib/db.ts in `createHaccpEntryWithChain` v
// src/lib/haccp-chain.ts na veji security/critical-fixes).
//
// FIX (P1 audit 2026-09-06): Dodan optional `tx` parameter, da se lahko
// ta funkcija kliče ZNOTRAJ outer transakcije (npr. v tip-pool PUT handler-ju
// kjer deleteMany + create + tipPool.update + auditLog morajo biti atomarni).
// Če `tx` ni podan, odpre svojo lastno transakcijo (backward compat).
//

import crypto from 'crypto'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

// Prisma's official transaction client type — what `db.$transaction(async (tx) => ...)`
// passes to the callback. We accept this as optional param so callers can
// embed hash-chain writes inside an outer transaction.
type TransactionClient = Prisma.TransactionClient

export interface TipDistributionChainEntry {
  tipPoolId: string
  employeeId: string
  employeeName: string
  hoursWorked: number
  points: number
  amount: number
  status: 'pending' | 'paid'
}

/**
 * Ustvari več TipDistribution vnose z hash verigo ZNOTRAJ transakcije.
 *
 * Ker so napitnine pogosto kreirane v batch-u (ena izmena = več zaposlenih),
 * sprejmemo array in zapišemo zaporedno znotraj ene transakcije — vsak vnos
 * referencira chainHash prejšnjega.
 *
 * FIX (P1 audit 2026-09-06): Če je `tx` podan, uporabi obstoječo transakcijo
 * (omogoča atomarno sestavljanje z drugimi operacijami — npr. brisanje starih
 * distribucij + kreiranje novih + posodobitev pool statusa v eni transakciji).
 * Če `tx` NI podan, odpre svojo lastno transakcijo (backward compat).
 *
 * Uporaba:
 *   // Brez tx (samostojna transakcija):
 *   const ids = await createTipDistributionWithChain([...])
 *
 *   // Znotraj outer transakcije (atomarno z drugimi operacijami):
 *   await db.$transaction(async (tx) => {
 *     await tx.tipDistribution.deleteMany({ where: { tipPoolId } })
 *     await createTipDistributionWithChain(entries, tx)
 *     await tx.tipPool.update({ where: { id: tipPoolId }, data: { status: 'distributed' } })
 *   })
 */
export async function createTipDistributionWithChain(
  entries: TipDistributionChainEntry[],
  tx?: TransactionClient,
): Promise<string[]> {
  if (entries.length === 0) return []

  // Če je tx podan, uporabi njega; sicer odpre svojo lastno transakcijo.
  const runInside = async (client: TransactionClient) => {
    // Pridobi zadnji chainHash ZNOTRAJ transakcije
    const lastEntry = await client.tipDistribution.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { chainHash: true },
    })
    let previousHash = lastEntry?.chainHash || ''

    const createdIds: string[] = []
    for (const entry of entries) {
      // Payload po komentarju v schemi: previousHash + title + value + status + date
      // Za TipDistribution: title = employeeName, value = amount, status = status, date = now
      const dateIso = new Date().toISOString()
      const hashPayload = [
        previousHash,
        entry.employeeName,
        entry.amount.toFixed(2),
        entry.status,
        dateIso,
      ].join('|')
      const chainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

      const created = await client.tipDistribution.create({
        data: {
          tipPoolId: entry.tipPoolId,
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          hoursWorked: entry.hoursWorked,
          points: entry.points,
          amount: entry.amount,
          status: entry.status,
          previousHash,
          chainHash,
        },
        select: { id: true },
      })
      createdIds.push(created.id)
      previousHash = chainHash // naslednji vnos v isti batch-u referencira tega
    }

    return createdIds
  }

  if (tx) {
    return runInside(tx)
  }
  return db.$transaction(runInside)
}

/**
 * Verificiraj integriteto TipDistribution verige.
 * Vrne prvi vnos, kjer je veriga prelomljena (ali null če je OK).
 */
export async function verifyTipDistributionChainIntegrity(): Promise<{ id: string; employeeName: string } | null> {
  try {
    const entries = await db.tipDistribution.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, employeeName: true, amount: true, status: true, createdAt: true, previousHash: true, chainHash: true },
      take: 10000,
    })

    let expectedPrevious = ''
    for (const entry of entries) {
      if (entry.previousHash !== expectedPrevious) {
        return { id: entry.id, employeeName: entry.employeeName }
      }
      const dateIso = entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt)
      const hashPayload = [
        entry.previousHash,
        entry.employeeName,
        entry.amount.toString(),
        entry.status,
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
    logger.error('TIP_DISTRIBUTION', 'Napaka pri preverjanju integritete verige:', error)
    return null
  }
}

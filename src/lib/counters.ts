import { db } from './db'
import type { PrismaClient } from '@prisma/client'

/** Transaction-compatible client type — accepts either PrismaClient or tx from $transaction callback */
export type DbClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/**
 * Atomically get and increment a counter value.
 * Uses upsert with increment to prevent race conditions.
 * 
 * Counter names: "orderNumber", "receiptNumber", "checkNumber"
 * 
 * @param tx Optional transaction client — when provided, the counter increment
 *           runs inside the caller's transaction, preventing gaps on rollback.
 */
export async function getNextCounter(name: string, tx?: DbClient): Promise<number> {
  const client = tx || db
  const counter = await client.counter.upsert({
    where: { name },
    update: { value: { increment: 1 } },
    create: { name, value: 1 },
  })
  return counter.value
}

/**
 * Get the next receipt number in format R-YYYY-NNNNNN
 * 
 * @param tx Optional transaction client — pass this when receipt creation
 *           must be atomic with counter increment (FURS compliance).
 */
export async function getNextReceiptNumber(tx?: DbClient): Promise<string> {
  const year = new Date().getFullYear()
  const counterName = `receiptNumber-${year}`
  const seq = await getNextCounter(counterName, tx)
  return `R-${year}-${String(seq).padStart(6, '0')}`
}

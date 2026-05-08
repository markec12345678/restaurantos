import { db } from './db'

/**
 * Atomically get and increment a counter value.
 * Uses upsert with increment to prevent race conditions.
 * 
 * Counter names: "orderNumber", "receiptNumber", "checkNumber"
 */
export async function getNextCounter(name: string): Promise<number> {
  const counter = await db.counter.upsert({
    where: { name },
    update: { value: { increment: 1 } },
    create: { name, value: 1 },
  })
  return counter.value
}

/**
 * Get the next receipt number in format R-YYYY-NNNNNN
 */
export async function getNextReceiptNumber(): Promise<string> {
  const seq = await getNextCounter('receiptNumber')
  const year = new Date().getFullYear()
  return `R-${year}-${String(seq).padStart(6, '0')}`
}

// ============================================
// TRANSACTIONAL OUTBOX — Core engine
// ============================================
// Problem: ko POS ustvari naročilo, moramo hkrati:
//   1. Zapisati v lokalno DB (lahko offline)
//   2. Poslati FURS račun
//   3. Poslati Stripe plačilo
//   4. Poslati email/SMS potrditev
//   5. Sinhronizirati z backend
//
// Rešitev: Transactional Outbox pattern.
// 1. V isti transakciji kot Order zapišemo OutboxEvent.
// 2. Background worker (cron ali queue) bere pending events in jih poskuša poslati.
// 3. Idempotentno (idempotencyKey prepreči duplikate).
// 4. Exponential backoff pri napakah.
//
// Prednosti:
//   - Garantirana dostava (at-least-once)
//   - Idempotentnost (at-most-once effective)
//   - Lofti od glavne transakcije (non-blocking)
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// --- Tipi ---
export type OutboxTarget = 'furs' | 'stripe' | 'email' | 'sms' | 'webhook' | 'internal'
export type OutboxStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'dead_letter'
export type AggregateType = 'order' | 'invoice' | 'furs_invoice' | 'payment' | 'reservation' | 'customer'

export interface CreateOutboxEventInput {
  aggregateType: AggregateType
  aggregateId: string
  eventType: string // 'created', 'updated', 'voided', 'paid', ...
  payload: Record<string, unknown>
  target: OutboxTarget
  targetEndpoint?: string
  idempotencyKey?: string // če ni podan, generira se iz aggregate
}

export interface OutboxStats {
  pending: number
  processing: number
  sent: number
  failed: number
  dead_letter: number
  oldestPending?: Date
}

// --- Konstante ---
const MAX_ATTEMPTS = 5
const BACKOFF_BASE_MS = 30_000 // 30s, 1min, 2min, 4min, 8min
const BACKOFF_MAX_MS = 60 * 60 * 1000 // 1h
const BATCH_SIZE = 25

// --- Glavne funkcije ---

// 1. KREIRAJ event (v transakciji z glavno entiteto)
export async function createOutboxEvent(input: CreateOutboxEventInput) {
  const idempotencyKey =
    input.idempotencyKey || `${input.aggregateType}:${input.aggregateId}:${input.eventType}:${input.target}`

  // Upsert — če že obstaja z istim idempotencyKey, ne naredi ničesar (idempotentno)
  const event = await db.outboxEvent.upsert({
    where: { idempotencyKey },
    create: {
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload as never,
      target: input.target,
      targetEndpoint: input.targetEndpoint || '',
      idempotencyKey,
      status: 'pending',
    },
    update: {}, // Ne posodobi — ohrani obstoječega
  })

  return event
}

// 2. KREIRAJ več eventov v eni transakciji (za complex workflows)
export async function createOutboxEvents(inputs: CreateOutboxEventInput[]) {
  if (inputs.length === 0) return []

  return await db.$transaction(
    inputs.map((input) =>
      db.outboxEvent.upsert({
        where: { idempotencyKey: input.idempotencyKey || `${input.aggregateType}:${input.aggregateId}:${input.eventType}:${input.target}` },
        create: {
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          eventType: input.eventType,
          payload: input.payload as never,
          target: input.target,
          targetEndpoint: input.targetEndpoint || '',
          idempotencyKey: input.idempotencyKey || `${input.aggregateType}:${input.aggregateId}:${input.eventType}:${input.target}`,
          status: 'pending',
        },
        update: {},
      }),
    ),
  )
}

// 3. PRIDOBI naslednjo batch events za procesiranje
export async function getNextOutboxBatch(limit = BATCH_SIZE) {
  const now = new Date()

  // Pridobi pending events (ali tiste z nextRetryAt v preteklosti)
  const events = await db.outboxEvent.findMany({
    where: {
      OR: [
        { status: 'pending' },
        {
          status: 'failed',
          nextRetryAt: { lte: now },
          attempts: { lt: MAX_ATTEMPTS },
        },
      ],
    },
    orderBy: [{ createdAt: 'asc' }],
    take: limit,
  })

  if (events.length === 0) return []

  // Označi kot processing (prepreči duplikate pri vzporednih workerjih)
  const eventIds = events.map((e) => e.id)
  await db.outboxEvent.updateMany({
    where: { id: { in: eventIds }, status: { in: ['pending', 'failed'] } },
    data: { status: 'processing' },
  })

  return events
}

// 4. OZNAČI kot uspešno poslano
export async function markOutboxSent(eventId: string, response?: unknown) {
  await db.outboxEvent.update({
    where: { id: eventId },
    data: {
      status: 'sent',
      processedAt: new Date(),
      lastError: '',
      // Shranimo response v payload če želimo kasneje debug
      ...(response ? { payload: { sent: true, response } as unknown as never } : {}),
    },
  })
}

// 5. OZNAČI kot neuspešno + exponential backoff
export async function markOutboxFailed(eventId: string, error: string) {
  const event = await db.outboxEvent.findUnique({ where: { id: eventId } })
  if (!event) return

  const attempts = event.attempts + 1
  const isDead = attempts >= event.maxAttempts

  // Exponential backoff: 30s, 60s, 120s, 240s, 480s ...
  const backoffMs = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempts - 1), BACKOFF_MAX_MS)
  const nextRetryAt = new Date(Date.now() + backoffMs)

  await db.outboxEvent.update({
    where: { id: eventId },
    data: {
      status: isDead ? 'dead_letter' : 'failed',
      attempts,
      lastError: error.substring(0, 500), // truncate
      nextRetryAt: isDead ? null : nextRetryAt,
    },
  })

  if (isDead) {
    logger.error('Outbox', `Event ${eventId} premaknjen v dead_letter (max attempts ${event.maxAttempts}): ${error}`)
  }
}

// 6. ROČNO ponovno poskusi (admin action)
export async function retryOutboxEvent(eventId: string) {
  await db.outboxEvent.update({
    where: { id: eventId },
    data: {
      status: 'pending',
      attempts: 0,
      lastError: '',
      nextRetryAt: new Date(),
    },
  })
}

// 7. STATISTIKA za dashboard
export async function getOutboxStats(): Promise<OutboxStats> {
  const grouped = await db.outboxEvent.groupBy({
    by: ['status'],
    _count: { status: true },
    _min: { createdAt: true },
  })

  const stats: OutboxStats = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    dead_letter: 0,
  }

  for (const g of grouped) {
    const count = g._count.status
    switch (g.status) {
      case 'pending':
        stats.pending = count
        if (g._min.createdAt) stats.oldestPending = g._min.createdAt
        break
      case 'processing': stats.processing = count; break
      case 'sent': stats.sent = count; break
      case 'failed': stats.failed = count; break
      case 'dead_letter': stats.dead_letter = count; break
    }
  }

  return stats
}

// 8. POČISTI stare sent events (cron job)
export async function cleanupOldSentEvents(daysOld = 30) {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
  const result = await db.outboxEvent.deleteMany({
    where: {
      status: 'sent',
      processedAt: { lt: cutoff },
    },
  })
  return result.count
}

// --- Processor registracija ---

type OutboxProcessor = (event: {
  id: string
  aggregateType: string
  aggregateId: string
  eventType: string
  payload: unknown
  targetEndpoint: string
}) => Promise<{ success: boolean; response?: unknown; error?: string }>

const processors: Record<OutboxTarget, OutboxProcessor> = {
  // FURS — pošlje račun na FURS
  furs: async (event) => {
    // V produkciji: kliči FURS API
    // Za MVP: implementirano preko obstoječih FURS libov
    try {
      // dynamic import, da ne obremenimo modula če se ne uporablja
      const { sendToFurs } = await import('@/lib/outbox/processors/furs')
      const result = await sendToFurs(event)
      return { success: true, response: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },

  // Stripe plačilo
  stripe: async (event) => {
    try {
      const { sendToStripe } = await import('@/lib/outbox/processors/stripe')
      const result = await sendToStripe(event)
      return { success: true, response: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },

  // Email
  email: async (event) => {
    try {
      const { sendEmail } = await import('@/lib/email')
      const payload = event.payload as { to: string; subject: string; html?: string; body?: string }
      await sendEmail({
        to: payload.to,
        subject: payload.subject,
        html: payload.html || payload.body || '',
      })
      return { success: true, response: { sent: true } }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },

  // SMS
  sms: async (event) => {
    try {
      const { sendSms } = await import('@/lib/sms')
      const payload = event.payload as { to: string; body: string }
      await sendSms({ to: payload.to, body: payload.body })
      return { success: true, response: { sent: true } }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },

  // Webhook
  webhook: async (event) => {
    try {
      const response = await fetch(event.targetEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          payload: event.payload,
          idempotencyKey: event.id,
        }),
      })
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${await response.text()}` }
      }
      return { success: true, response: { status: response.status } }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },

  // Internal (proži notranji dogodek)
  internal: async (event) => {
    try {
      const { emitEvent } = await import('@/lib/event-emitter')
      const eventName = `${event.aggregateType}.${event.eventType}` as never
      await emitEvent(eventName, event.payload as never)
      return { success: true, response: { emitted: true } }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },
}

// 9. PROCESIRAJ batch (glavni entry point za worker)
export async function processOutboxBatch(limit = BATCH_SIZE): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const events = await getNextOutboxBatch(limit)
  let succeeded = 0
  let failed = 0

  for (const event of events) {
    const processor = processors[event.target as OutboxTarget]
    if (!processor) {
      await markOutboxFailed(event.id, `Unknown target: ${event.target}`)
      failed++
      continue
    }

    try {
      const result = await processor({
        id: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        targetEndpoint: event.targetEndpoint,
      })

      if (result.success) {
        await markOutboxSent(event.id, result.response)
        succeeded++
      } else {
        await markOutboxFailed(event.id, result.error || 'Unknown error')
        failed++
      }
    } catch (err) {
      await markOutboxFailed(event.id, err instanceof Error ? err.message : String(err))
      failed++
    }
  }

  return { processed: events.length, succeeded, failed }
}

// 10. EXPORT za testing
export { MAX_ATTEMPTS, BACKOFF_BASE_MS, BACKOFF_MAX_MS, BATCH_SIZE }

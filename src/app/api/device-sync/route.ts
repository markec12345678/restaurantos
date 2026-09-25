// ============================================
// /api/device-sync — BATCH PUSH + SERVER ACKNOWLEDGEMENT
// (R128, epic #115 P0-5: offline-first POS + varen reconnect/sync)
// ============================================
// Strežniška polovica offline vrste: POS naprava ob reconnectu pošlje
// batch operacij ({ deviceId, operations[] }); vsaka operacija ima
// stabilen clientOperationId. Exactly-once kanon:
//
//   1. Ledger pre-check: (deviceId, clientOperationId) že obstaja s
//      statusom 'applied'/'duplicate' → REPLAY brez re-aplikacije
//      (odgovor = shranjen ack, status 'duplicate', replay: true).
//   2. Aplikacija: DELEGACIJA na kanonske handlerje (handlePostOrder /
//      performOrderSoftDelete) — domenska idempotencija
//      (Order.idempotencyKey @unique, CAS prehodi, advisory locki)
//      ostane AVTORITATIVNA zaščita; ledger je ack + forenzika.
//   3. Ledger zapis PO aplikaciji (best-effort, nikoli fatalno za ack).
//
// Plačila NISO del sync kanona (kanon P0-5: payment offline NI varno
// podprt — POST /api/payments z x-offline-sync → 422 fail-closed).
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db, createAuditLog } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { checkRateLimitAsync, getClientIp, DEVICE_SYNC_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { handlePostOrder } from '../orders/_helpers/post-handler'
import { performOrderSoftDelete } from '../orders/[id]/webhooks/perform-soft-delete'

export const dynamic = 'force-dynamic'

// Enak format kot x-device-id / x-client-operation-id headerji v
// offline-ledger helperju — enoten identifikator naprave/operacije.
const DEVICE_ID_REGEX = /^[A-Za-z0-9_-]{8,64}$/

const operationSchema = z.object({
  clientOperationId: z
    .string()
    .regex(DEVICE_ID_REGEX, 'clientOperationId mora imeti 8–64 znakov [A-Za-z0-9_-]'),
  type: z.enum(['order.create', 'order.cancel']),
  // Payload se validira PER TIP (order.create → createOrderSchema v
  // delegatu; order.cancel → cancelPayloadSchema spodaj) — envelope
  // namerno prenema unknown, da delegat ostane edini vir resnice.
  payload: z.unknown(),
  createdAt: z.string().datetime().optional(),
  retryCount: z.number().int().min(0).max(100).default(0),
})

const deviceSyncSchema = z.object({
  deviceId: z.string().regex(DEVICE_ID_REGEX, 'deviceId mora imeti 8–64 znakov [A-Za-z0-9_-]'),
  operations: z.array(operationSchema).min(1, 'Batch mora vsebovati vsaj eno operacijo').max(50),
})

const cancelPayloadSchema = z.object({
  orderId: z.string().min(1, 'orderId je obvezen'),
  reason: z.string().max(500).optional(),
})

// ---------- Rezultatne tipe ----------
interface SyncOpResult {
  clientOperationId: string
  status: 'applied' | 'duplicate' | 'rejected'
  orderId?: string
  error?: string
  message?: string
  replay?: boolean
  /** Lokacija naročila (fallback za ledger, ko seja nima scope-a) */
  locationId?: string | null
  /** Povzetek apliciranega naročila (order.create — izhoden delegat body) */
  data?: unknown
}

// ---------- Ledger zapis (best-effort, race-safe) ----------
async function writeLedgerRow(args: {
  deviceId: string
  sessionLocationId: string | null
  clientOperationId: string
  operationType: string
  payload: unknown
  clientRetryCount: number
  result: SyncOpResult
  employeeId: string | null
}): Promise<void> {
  try {
    // Ledger zahteva locationId NOT NULL: session scope ima prednost;
    // fallback = lokacija apliciranega naročila (super-admin null-scope).
    const locationId = args.sessionLocationId ?? args.result.locationId ?? null
    if (!locationId) {
      // Super-admin null-scope + operacija brez apliciranega naročila
      // (rejected) → ni znane lokacije → vrstica se IZPUSTI (forenzika
      // ostane v audit logu batcha + odgovoru).
      logger.warn(
        'DEVICE_SYNC',
        `ledger vrstica izpuščena (ni znane lokacije): ${args.deviceId}/${args.clientOperationId}`,
      )
      return
    }

    const ack: Record<string, unknown> = {
      status: args.result.status,
      ...(args.result.orderId ? { orderId: args.result.orderId } : {}),
      ...(args.result.error ? { error: args.result.error } : {}),
      ...(args.result.replay ? { replay: true } : {}),
    }

    try {
      await db.deviceSyncOperation.create({
        data: {
          deviceId: args.deviceId,
          locationId,
          clientOperationId: args.clientOperationId,
          operationType: args.operationType,
          payload: (args.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          clientRetryCount: args.clientRetryCount,
          status: args.result.status,
          orderId: args.result.orderId ?? null,
          ack: ack as Prisma.InputJsonValue,
          lastError: args.result.error ?? null,
          employeeId: args.employeeId,
          processedAt: new Date(),
        },
      })
    } catch (error: unknown) {
      // Race-safe: P2002 na (deviceId, clientOperationId) → vzporedni
      // zapisovalec je že zapisal ledger vrstico — fetch + tiho.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await db.deviceSyncOperation
          .findUnique({
            where: {
              deviceId_clientOperationId: {
                deviceId: args.deviceId,
                clientOperationId: args.clientOperationId,
              },
            },
            select: { id: true },
          })
          .catch(() => null)
        return
      }
      throw error
    }
  } catch (error: unknown) {
    // NIKOLI fatalno za ack — operacija je že aplicirana; ledger je dokaz.
    logger.error('DEVICE_SYNC', 'zapis ledger vrstice ni uspel', error)
  }
}

// ---------- POST: batch push ----------
export async function POST(req: Request) {
  try {
    // Rate limiting — batch sync je drag (do 50 operacij z API klici)
    const rl = await checkRateLimitAsync('device-sync', getClientIp(req), DEVICE_SYNC_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // Vsak avtenticiran zaposleni sme sinhronizirati (delegati uveljavljajo
    // svoje semantike: order.create → take_orders pot v post-handlerju,
    // order.cancel → manager/storno pravila perform-soft-delete kanona).
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // Tenant scope (kanon) — takoj po requireAuth, PRED body parse-om
    const searchParams = new URL(req.url).searchParams
    const sessionScope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/device-sync',
    })
    if ('error' in sessionScope) return sessionScope.error

    // Body validacija (sanitize: false — payload gre delegatu v prvotni
    // obliki, ki zna validirati svoje; 1 MB pokrije 50 operacij)
    const { data: body, error: validationError } = await validateRequest(req, deviceSyncSchema, {
      maxBodySize: 1024 * 1024,
      sanitize: false,
    })
    if (validationError) return validationError

    // ---------- Registracija / heartbeat / fail-closed lokacijski guard ----------
    const device = await db.deviceRegistry.findUnique({ where: { deviceId: body.deviceId } })
    if (!device) {
      // Samodejna registracija: naprava, ki prvič sync-a, se uveljavi.
      // locationId iz session scope-a (super-admin null-scope → null je OK,
      // stolpec je nullable; naprava je potem "globalna").
      await db.deviceRegistry.create({
        data: {
          deviceId: body.deviceId,
          name: `POS-${body.deviceId.slice(0, 8)}`,
          type: 'pos',
          locationId: sessionScope.locationId,
          status: 'online',
          lastSeenAt: new Date(),
        },
      })
    } else if (
      device.locationId &&
      sessionScope.locationId &&
      device.locationId !== sessionScope.locationId
    ) {
      // Fail-closed: naprava je vezana na drugo lokacijo kot seja → 403
      // (prepreči "prevzem" tuje naprave s krajo seje lokacije B).
      return NextResponse.json(
        { error: 'DEVICE_LOCATION_MISMATCH' },
        { status: 403 },
      )
    } else {
      // Heartbeat: naprava je živa in sync-a
      await db.deviceRegistry.update({
        where: { id: device.id },
        data: { status: 'online', lastSeenAt: new Date() },
      })
    }

    // ---------- Batch aplikacija (sekvenčno) ----------
    const results: SyncOpResult[] = []

    for (const op of body.operations) {
      // 1) EXACTLY-ONCE pre-check: operacija je že aplicirana → replay
      //    shranjenega acka BREZ re-aplikacije (200, status 'duplicate').
      const existingRow = await db.deviceSyncOperation.findUnique({
        where: {
          deviceId_clientOperationId: {
            deviceId: body.deviceId,
            clientOperationId: op.clientOperationId,
          },
        },
      })
      if (existingRow && (existingRow.status === 'applied' || existingRow.status === 'duplicate')) {
        const storedAck = (existingRow.ack ?? {}) as Record<string, unknown>
        const result: SyncOpResult = {
          clientOperationId: op.clientOperationId,
          replay: true,
          ...storedAck,
          status: 'duplicate', // defensivno: ack je vedno 'duplicate' za replay
        }
        results.push(result)
        continue
      }

      let result: SyncOpResult

      // 2) Aplikacija po tipu (delegacija na kanonske handlerje)
      if (op.type === 'order.create') {
        // Delegat pričakuje POST /api/orders kontekst: sintetičen Request
        // z originalnim payloadom + REALNA seja/scope iz device-sync seje.
        const syntheticReq = new Request('http://local/api/orders', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(op.payload),
        })
        const delegateRes = await handlePostOrder(syntheticReq, {
          session: authResult.session,
          scope: sessionScope,
          searchParams,
        })

        let parsed: Record<string, unknown> = {}
        try {
          parsed = (await delegateRes.json()) as Record<string, unknown>
        } catch {
          parsed = {}
        }

        if (delegateRes.status === 201) {
          result = {
            clientOperationId: op.clientOperationId,
            status: 'applied',
            orderId: typeof parsed.id === 'string' ? parsed.id : undefined,
            data: parsed,
            locationId: typeof parsed.locationId === 'string' ? parsed.locationId : null,
          }
        } else if (delegateRes.status === 200) {
          // Idempotency replay v delegatu (isti idempotencyKey, druga pot)
          result = {
            clientOperationId: op.clientOperationId,
            status: 'duplicate',
            replay: true,
            orderId: typeof parsed.id === 'string' ? parsed.id : undefined,
            data: parsed,
            locationId: typeof parsed.locationId === 'string' ? parsed.locationId : null,
          }
        } else {
          result = {
            clientOperationId: op.clientOperationId,
            status: 'rejected',
            error:
              typeof parsed.error === 'string' && parsed.error
                ? parsed.error
                : 'ORDER_CREATE_FAILED',
            message: typeof parsed.message === 'string' ? parsed.message : undefined,
          }
        }
      } else if (op.type === 'order.cancel') {
        const cancelPayload = cancelPayloadSchema.safeParse(op.payload)
        if (!cancelPayload.success) {
          result = {
            clientOperationId: op.clientOperationId,
            status: 'rejected',
            error: 'INVALID_CANCEL_PAYLOAD',
          }
        } else {
          // Scoped load: fail-closed na lokacijo seje (super-admin vidi vse)
          const order = await db.order.findFirst({
            where: {
              id: cancelPayload.data.orderId,
              ...(sessionScope.locationId ? { locationId: sessionScope.locationId } : {}),
            },
            include: { receipt: true },
          })
          if (!order) {
            result = {
              clientOperationId: op.clientOperationId,
              status: 'rejected',
              error: 'ORDER_NOT_FOUND',
            }
          } else {
            // Delegacija na kanonski soft-delete (Serializable tx + advisory
            // lock + CAS + vračilo zaloge). reason iz payloada se shrani v
            // ledger (delegat ima fiksna cancelReason sporočila).
            const claim = await performOrderSoftDelete(
              cancelPayload.data.orderId,
              order,
              authResult.session?.employeeId,
            )
            if (claim.ok) {
              result = {
                clientOperationId: op.clientOperationId,
                status: 'applied',
                orderId: cancelPayload.data.orderId,
                locationId: order.locationId ?? null,
              }
            } else if (claim.reason === 'already_cancelled') {
              result = {
                clientOperationId: op.clientOperationId,
                status: 'duplicate',
                orderId: cancelPayload.data.orderId,
                locationId: order.locationId ?? null,
              }
            } else {
              const errorByReason: Record<string, string> = {
                paid: 'PAID_ORDER_CANCEL',
                completed: 'ORDER_COMPLETED',
                conflict: 'SYNC_CONFLICT',
                not_found: 'ORDER_NOT_FOUND',
              }
              result = {
                clientOperationId: op.clientOperationId,
                status: 'rejected',
                orderId: cancelPayload.data.orderId,
                error: errorByReason[claim.reason] ?? 'SYNC_CONFLICT',
                locationId: order.locationId ?? null,
              }
            }
          }
        }
      } else {
        // Zod enum to zagotovi nemogoče — defensivna fail-closed veja
        result = {
          clientOperationId: op.clientOperationId,
          status: 'rejected',
          error: 'UNSUPPORTED_OPERATION',
        }
      }

      // 3) Ledger zapis PO aplikaciji (best-effort, race-safe)
      await writeLedgerRow({
        deviceId: body.deviceId,
        sessionLocationId: sessionScope.locationId,
        clientOperationId: op.clientOperationId,
        operationType: op.type,
        payload: op.payload,
        clientRetryCount: op.retryCount,
        result,
        employeeId: authResult.session?.employeeId ?? null,
      })

      results.push(result)
    }

    // ---------- Batch audit (en vnos na batch, best-effort) ----------
    const appliedCount = results.filter((r) => r.status === 'applied').length
    const duplicateCount = results.filter((r) => r.status === 'duplicate').length
    const rejectedCount = results.filter((r) => r.status === 'rejected').length

    try {
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'DEVICE_SYNC',
        entityType: 'DeviceSyncOperation',
        details: {
          deviceId: body.deviceId,
          total: results.length,
          applied: appliedCount,
          duplicate: duplicateCount,
          rejected: rejectedCount,
        },
        locationId: sessionScope.locationId,
      })
    } catch (error: unknown) {
      logger.error('DEVICE_SYNC', 'batch audit zapis ni uspel', error)
    }

    return NextResponse.json({ results, appliedCount, duplicateCount, rejectedCount })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/device-sync', 'Napaka pri sinhronizaciji naprave')
  }
}

// ---------- GET: monitoring (brez payload/ack teles) ----------
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/device-sync',
    })
    if ('error' in scope) return scope.error

    const where: Record<string, unknown> = scope.locationId
      ? { locationId: scope.locationId }
      : {}

    const [operations, groupBy] = await Promise.all([
      db.deviceSyncOperation.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          deviceId: true,
          locationId: true,
          clientOperationId: true,
          operationType: true,
          status: true,
          orderId: true,
          lastError: true,
          clientRetryCount: true,
          employeeId: true,
          receivedAt: true,
          processedAt: true,
        },
      }),
      db.deviceSyncOperation.groupBy({ by: ['status'], _count: { _all: true }, where }),
    ])

    // Determinističen vrstni red (monitoring UI pričakova stabilen izpis)
    const stats = groupBy
      .map((g) => ({ status: g.status, count: g._count._all }))
      .sort((a, b) => a.status.localeCompare(b.status))

    return NextResponse.json({ operations, stats })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/device-sync', 'Napaka pri pridobivanju sync operacij')
  }
}

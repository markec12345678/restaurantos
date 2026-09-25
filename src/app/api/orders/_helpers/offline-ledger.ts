// ============================================
// OFFLINE ORDER LEDGER (R128, epic #115 P0-5)
// ============================================
// Best-effort zapis DeviceSyncOperation ledger vrstice ob uspešnem
// POST /api/orders, kadar je zahtevek prišel IZ offline vrste naprave
// (headerji x-offline-sync + x-device-id + x-client-operation-id).
//
// Namen: (deviceId, clientOperationId) je unique → replay iste offline
// operacije po enkratni poti (neposredni POST /api/orders ob reconnectu,
// R128-client) se prav tako deduplificira v ledgerju — enoten exactly-once
// dokaz na nivoju naprave, poleg domenske idempotencije Order.idempotencyKey
// (ki ostane AVTORITATIVNA zaščita).
//
// Best-effort kanon: napaka zapisa NIKOLI ne spremeni odgovora ruta
// (naročilo je že ustvarjeno) — samo console.error.
// ============================================

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

// Isti format kot deviceId/clientOperationId v /api/device-sync shemi —
// headerji iz offline vrste morajo biti formatno validirani (fail-closed:
// neustrezen format = brez ledger zapisa, naročilo pa se vseeno obdeluje).
const OFFLINE_ID_REGEX = /^[A-Za-z0-9_-]{8,64}$/

export interface OfflineLedgerInput {
  orderId: string
  idempotencyKey: string
  /** 201 (nov zapis) → 'applied'; 200 (idempotency replay) → 'duplicate' */
  status: 'applied' | 'duplicate'
  /** Lokacija naročila (v post-handlerju vedno resolvljana, non-null) */
  locationId: string
  employeeId?: string | null
  /** Snapshot validiranega order payloada (strežniški dokaz) */
  payload: unknown
}

/** Preveri, ali zahtevek nosi popolne + formatno veljavne offline headerje. */
export function hasOfflineSyncHeaders(req: Request): {
  deviceId: string
  clientOperationId: string
} | null {
  if (req.headers.get('x-offline-sync') !== 'true') return null
  const deviceId = req.headers.get('x-device-id') ?? ''
  const clientOperationId = req.headers.get('x-client-operation-id') ?? ''
  if (!OFFLINE_ID_REGEX.test(deviceId)) return null
  if (!OFFLINE_ID_REGEX.test(clientOperationId)) return null
  return { deviceId, clientOperationId }
}

/**
 * Zapiši ledger vrstico za offline order.create operacijo.
 * Pokliče se IZKLJUČNO na uspešnih return točkah handlePostOrder (201/200).
 * Race-safe: P2002 na (deviceId, clientOperationId) → vrstica že obstaja
 * (isto operacijo je zapisal /api/device-sync ali vzporedni replay) — tiho.
 */
export async function recordOfflineOrderLedger(
  req: Request,
  input: OfflineLedgerInput,
): Promise<void> {
  try {
    const ids = hasOfflineSyncHeaders(req)
    if (!ids) return // ni offline operacija — tukaj nič ne zapisujemo

    const ack = {
      status: input.status,
      orderId: input.orderId,
      ...(input.status === 'duplicate' ? { replay: true } : {}),
    }

    try {
      await db.deviceSyncOperation.create({
        data: {
          deviceId: ids.deviceId,
          locationId: input.locationId,
          clientOperationId: ids.clientOperationId,
          operationType: 'order.create',
          payload: input.payload as Prisma.InputJsonValue,
          status: input.status,
          orderId: input.orderId,
          ack: ack as Prisma.InputJsonValue,
          employeeId: input.employeeId ?? null,
          processedAt: new Date(),
        },
      })
    } catch (error: unknown) {
      // Race-safe: drug zapisovalec (device-sync batch ALI vzporedni replay
      // iste operacije) je že zapisal ledger vrstico — samo preveri obstoj.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await db.deviceSyncOperation
          .findUnique({
            where: {
              deviceId_clientOperationId: {
                deviceId: ids.deviceId,
                clientOperationId: ids.clientOperationId,
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
    // NIKOLI fatalno za odgovor — naročilo je že ustvarjeno/replayano.
    logger.error('OFFLINE_LEDGER', 'zapis DeviceSyncOperation ni uspel', error)
  }
}

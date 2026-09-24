// ============================================
// R124 (epic #115, P0-03): AVTOMATSKI PREKLIC PHANTOM NAROČILA
// ============================================
// Problem (najden v R124 forenziki): delivery webhook (Glovo/Wolt) je
// COMMITIRAL naročilo, dedukcija zaloge je tekla v LOČENI transakciji;
// ob INSUFFICIENT_STOCK je webhook vrnil 409, a naročilo je ostalo
// 'pending' v bazi → PHANTOM naročilo v KDS/POS (kuhinja pripravlja
// naročilo, ki ne bo nikoli dostavljeno). Komentar v ruti je obljubljal
// cancel — implementacija ni obstajala.
//
// Kanon: "varna propagacija med kanali" — zavrnjeno naročilo platforme
// NE SME ostati vidno operaterju. CAS claim (pending → cancelled) je
// varen proti tekmam: ne stopi po naročilu, ki ga je že prevzel
// operater (status se je spremenil).

import { db, createAuditLog } from '../db'
import { logger } from '../logger'

export async function cancelOrderForInsufficientStock(
  orderId: string,
  orderNumber: string | number,
  provider: string,
  detail: string,
): Promise<boolean> {
  // CAS claim — samo 'pending' → 'cancelled' (nikoli ne stopi po
  // already-accepted / completed naročilu)
  const res = await db.order.updateMany({
    where: { id: orderId, status: 'pending' },
    data: {
      status: 'cancelled',
      notes: `PREKLICANO (${provider} — nezadostna zaloga): ${detail}`,
    },
  })
  if (res.count === 0) {
    logger.warn(provider, `Phantom-cancel skip — order ${orderNumber} ni več pending`)
    return false
  }

  // Postavke tudi cancelirane (KDS item-level filtri)
  await db.orderItem.updateMany({
    where: { orderId },
    data: { status: 'cancelled' },
  })

  await createAuditLog({
    action: 'AUTO_CANCEL_INSUFFICIENT_STOCK',
    entityType: 'Order',
    entityId: orderId,
    details: {
      provider,
      orderNumber,
      reason: detail,
      automated: true,
    },
  }).catch(err => logger.error(provider, 'Audit log napaka (phantom-cancel):', err))

  logger.info(provider, `Phantom order ${orderNumber} cancelled (nezadostna zaloga)`)
  return true
}

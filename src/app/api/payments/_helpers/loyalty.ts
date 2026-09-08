// Pomožne funkcije za Payments API — Zvestobne točke
//
// FIX P0-C3B: PaymentInput.locationId je dodan za tenant-scoped loyalty config.
// FIX P0-C4 (Phase 3 aktivacija): Location model IMA loyalty polja (loyaltyEnabled,
// loyaltyPointsPerEuro, loyaltyPointsValue). resolveLoyaltyConfig() zdaj bere
// konfiguracijo per-lokacija z global fallbackom (enak vzorec kot
// getReportRecipients / getFursConfig):
//   1. Če je locationId podan IN je lokacija EKSPRESNO vklopila last program
//      (Location.loyaltyEnabled=true) → uporabi lokacijske vrednosti
//      (filiala ima lahko drugačen loyalty program)
//   2. Sicer → RestaurantSettings (global) — single-tenant backward compat
//      (loyalty program je običajno matični; privzeta vrednost
//      Location.loyaltyEnabled=false pomeni "ni nastavljeno" → fallback)
// Dedukcija točk (unovčenje) vedno dovoljena ne glede na enabled — točke,
// pridobljene prej, ostanejo uporabne; pointsValue za fraud-check pa se
// rešuje po isti verigi.

import { Prisma } from '@prisma/client'
import { toNum, round2, subtract } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import type { PaymentInput } from './types'

// ─── Loyalty konfiguracija — per-location override z global fallbackom ───

export interface ResolvedLoyaltyConfig {
  enabled: boolean
  pointsPerEuro: number
  pointsValue: number
  source: 'location' | 'global'
}

/**
 * REŠI loyalty konfiguracijo za plačilo (P0-C4 Phase 3).
 *
 * Veriga: Location (če loyaltyEnabled=true) → RestaurantSettings (global).
 * Location lookup je odporen na napake (drift/stolpec manjka) — ob napaki
 * degradira na global konfiguracijo, da plačilo NIKOLI ne pada zaradi
 * loyalty nastavitev (varnostno načelo: konfiguracija je po možnosti
 * per-lokacija, plačilna transakcija pa vedno končana).
 */
export async function resolveLoyaltyConfig(
  tx: Prisma.TransactionClient,
  locationId?: string | null,
): Promise<ResolvedLoyaltyConfig> {
  // 1. Global (vedno preberemo — fallback + dedukcijske vrednosti)
  const settings = await tx.restaurantSettings.findFirst({ where: { isActive: true } })
  const global = {
    enabled: settings?.loyaltyEnabled ?? false,
    pointsPerEuro: settings?.loyaltyPointsPerEuro ? toNum(settings.loyaltyPointsPerEuro) : 1,
    pointsValue: settings?.loyaltyPointsValue ? toNum(settings.loyaltyPointsValue) : 0.01,
  }

  // 2. Per-location override — SAMO če je lokacija eksplicitno vklopila program
  if (locationId) {
    try {
      const location = await tx.location.findUnique({
        where: { id: locationId },
        select: {
          loyaltyEnabled: true,
          loyaltyPointsPerEuro: true,
          loyaltyPointsValue: true,
        },
      })
      if (location?.loyaltyEnabled) {
        const locPointsPerEuro =
          location.loyaltyPointsPerEuro > 0 ? location.loyaltyPointsPerEuro : global.pointsPerEuro
        const locPointsValue =
          location.loyaltyPointsValue != null && toNum(location.loyaltyPointsValue) > 0
            ? toNum(location.loyaltyPointsValue)
            : global.pointsValue
        return {
          enabled: true,
          pointsPerEuro: locPointsPerEuro,
          pointsValue: locPointsValue,
          source: 'location',
        }
      }
    } catch (err) {
      // Odpornost: lookup spodletel (npr. shema-drift) → global fallback
      logger.warn(
        'LOYALTY',
        `Location loyalty lookup spodletelo (${locationId}) — fallback na global: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return { ...global, source: 'global' }
}

// ─── Zvestobne točke — odbitje znotraj transakcije ──────────

export async function handleLoyaltyPointsDeduction(
  tx: Prisma.TransactionClient,
  data: PaymentInput,
  checkOrderId: string | null,
): Promise<void> {
  if (data.type !== 'loyalty' || !data.loyaltyAccountId || data.loyaltyPointsUsed <= 0) return

  // OPTIMIZACIJA: select namesto privzetega include — potrebujemo samo isActive in pointsBalance
  const loyaltyAccount = await tx.loyaltyAccount.findUnique({
    where: { id: data.loyaltyAccountId },
    select: { isActive: true, pointsBalance: true },
  })
  if (!loyaltyAccount) {
    throw new Error('Zvestobni račun ni najden')
  }
  // FIX HIGH: Preveri, da je račun aktiven
  if (!loyaltyAccount.isActive) {
    throw new Error('Zvestobni račun ni aktiven')
  }
  if (loyaltyAccount.pointsBalance < data.loyaltyPointsUsed) {
    throw new Error('Ni dovolj točk na zvestobnem računu')
  }

  // FIX BUG-LOY-1: Validiraj vrednost točk proti znesku plačila — prepreči fraud
  // (1 točka = 0.01 EUR po defaultu; prepreči da 1 točka plača 1000 EUR)
  // FIX P0-C4: pointsValue se rešuje per-lokacija (Location override → global)
  const config = await resolveLoyaltyConfig(tx, data.locationId)
  const pointsValue = config.pointsValue > 0 ? config.pointsValue : 0.01
  const maxPayableAmount = round2(data.loyaltyPointsUsed * pointsValue)
  if (toNum(data.amount) > maxPayableAmount) {
    throw new Error(
      `Znesek plačila (${toNum(data.amount).toFixed(2)} EUR) presega vrednost točk ` +
      `(${data.loyaltyPointsUsed} točk × ${pointsValue} EUR = ${maxPayableAmount.toFixed(2)} EUR)`
    )
  }

  // FIX: Uporabi atomic decrement namesto read-then-write — prepreči race condition
  const updateResult = await tx.loyaltyAccount.updateMany({
    where: { id: data.loyaltyAccountId, pointsBalance: { gte: data.loyaltyPointsUsed } },
    data: { pointsBalance: { decrement: data.loyaltyPointsUsed } },
  })
  if (updateResult.count === 0) {
    throw new Error('Ni dovolj točk na zvestobnem računu (concurrent modification)')
  }

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: data.loyaltyAccountId,
      type: 'redeem',
      points: -data.loyaltyPointsUsed,
      reason: 'Unovčenje točk za plačilo',
      orderId: checkOrderId || null,
      checkId: data.checkId,
      monetaryValue: data.amount,
    },
  })
}

// ─── Zvestobne točke — pridobitev ob plačilu ────────────────

export async function handleLoyaltyEarn(
  tx: Prisma.TransactionClient,
  data: PaymentInput,
  checkOrderId: string | null,
): Promise<void> {
  // FIX HIGH: Samodejno pridobi zvestobne točke ob plačilu — loyalty earn
  // FIX P0-C4: konfiguracija (enabled + pointsPerEuro) se rešuje per-lokacija
  // (Location override → global) — filiala ima lahko last loyalty program
  if (!data.loyaltyAccountId || data.type === 'loyalty') return

  const config = await resolveLoyaltyConfig(tx, data.locationId)
  if (!config.enabled) return

  const pointsPerEuro = config.pointsPerEuro || 1
  // Točke se računajo po znesku plačila (brez napitnine)
  const earnBase = round2(subtract(toNum(data.amount), toNum(data.tipAmount)))
  const pointsToEarn = Math.max(0, Math.floor(earnBase * pointsPerEuro))

  if (pointsToEarn <= 0) return

  // Atomic increment — prepreči race condition
  await tx.loyaltyAccount.updateMany({
    where: { id: data.loyaltyAccountId, isActive: true },
    data: {
      pointsBalance: { increment: pointsToEarn },
      lifetimePoints: { increment: pointsToEarn },
    },
  })

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: data.loyaltyAccountId,
      type: 'earn',
      points: pointsToEarn,
      reason: `Točke za plačilo ${toNum(data.amount).toFixed(2)} EUR`,
      orderId: checkOrderId || null,
      checkId: data.checkId,
      monetaryValue: earnBase,
    },
  })
}

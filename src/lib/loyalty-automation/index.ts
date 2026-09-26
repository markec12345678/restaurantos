// ============================================
// SMS LOYALTY AUTOMATION
// ============================================
// Avtomatizira SMS obvestila za loyalty dogodke:
//   1. Tier upgrade → "Čestitamo, zdaj ste Gold član!"
//   2. Reward unlocked → "Imate 500 točk — unovčite za brezplačno kosilo!"
//   3. Birthday bonus → "Vse najboljše! Podarili smo vam 100 točk."
//   4. Win-back (60 dni neaktivnosti) → "Pogrešamo vas! 200 točk za naslednji obisk."
//   5. Points expiring soon → "Opomba: 300 točk poteče čez 30 dni."
//
// Raziskava 2025: SMS open rate 98% vs email 20-30%.
// ============================================

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendSms, type SmsMessage } from '@/lib/sms'
// odstranjen prazen import (runda 12 lint cleanup)
import { createOutboxEvent } from '@/lib/outbox'
import { tierLabelSi } from '@/lib/loyalty-tiers'
// R143-b (epic #115 #30): birthday fix (mesec/dan v LJ času) + FIFO
// expiring približek za notify-only akcijo (skupen vir z lifecycle ruta)
import { isBirthdayToday } from '@/lib/loyalty/birthday'
import { computeExpiringPoints } from '@/lib/loyalty/lifecycle'

// --- Konstante ---
export const POINTS_EXPIRY_DAYS = 365 // Točke potečejo po 1 letu
export const WINBACK_INACTIVE_DAYS = 60
export const BIRTHDAY_BONUS_POINTS = 100
export const WINBACK_BONUS_POINTS = 200

// --- Tipi ---
export type LoyaltyAutomationType =
  | 'tier_upgrade'
  | 'reward_unlocked'
  | 'birthday_bonus'
  | 'winback'
  | 'points_expiring'
  | 'welcome'

export interface LoyaltyAutomationConfig {
  enabled: boolean
  smsEnabled: boolean
  // Kdaj naj se pošlje
  triggers: {
    tierUpgrade: boolean
    rewardUnlocked: boolean
    birthdayBonus: boolean
    winback: boolean
    pointsExpiring: boolean
    welcome: boolean
  }
  // Thresholdi
  thresholds: {
    rewardUnlockedPoints: number // npr. 500
    pointsExpiringDays: number // 30 dni pred potekom
    winbackInactiveDays: number
  }
}

// Default konfiguracija
export const DEFAULT_CONFIG: LoyaltyAutomationConfig = {
  enabled: true,
  smsEnabled: true,
  triggers: {
    tierUpgrade: true,
    rewardUnlocked: true,
    birthdayBonus: true,
    winback: true,
    pointsExpiring: true,
    welcome: true,
  },
  thresholds: {
    rewardUnlockedPoints: 500,
    pointsExpiringDays: 30,
    winbackInactiveDays: WINBACK_INACTIVE_DAYS,
  },
}

// --- Predloge SMS sporočil ---

const TEMPLATES: Record<LoyaltyAutomationType, (data: Record<string, unknown>) => string> = {
  tier_upgrade: (d) =>
    `Čestitamo ${d.customerName || ''}! Napravili ste vas na ${d.newTier} nivo v našem zvestobnem programu. Uživajte v ekskluzivnih ugodnostih!`,
  reward_unlocked: (d) =>
    `Odlično ${d.customerName || ''}! Zbrali ste ${d.points} točk. Unovčite jih za ${d.rewardDescription || 'nagrado'} pri nas.`,
  birthday_bonus: (d) =>
    `Vse najboljše za rojstni dan, ${d.customerName || ''}! 🎉 Podarili smo vam ${BIRTHDAY_BONUS_POINTS} točk zvestobnega programa.`,
  winback: (d) =>
    `Pogrešamo vas, ${d.customerName || ''}! Podarili smo vam ${WINBACK_BONUS_POINTS} točk za vaš naslednji obisk. Velja 14 dni.`,
  points_expiring: (d) =>
    `Opomba: ${d.points} točk zvestobnega programa poteče čez ${d.daysUntilExpiry} dni. Unovčite jih pravočasno!`,
  welcome: (d) =>
    `Dobrodošli v zvestobnem programu, ${d.customerName || ''}! Z vsakim nakupom zbirate točke. Vaše stanje: ${d.points} točk.`,
}

// --- Glavne funkcije ---

// 1. TIER UPGRADE — ko stranka preide na višji nivo
export async function triggerTierUpgrade(
  loyaltyAccountId: string,
  oldTier: string,
  newTier: string,
  config: LoyaltyAutomationConfig = DEFAULT_CONFIG,
): Promise<void> {
  if (!config.enabled || !config.triggers.tierUpgrade) return

  const account = await db.loyaltyAccount.findUnique({
    where: { id: loyaltyAccountId },
  })
  if (!account || !account.customerPhone || !account.isActive) return

  const message = TEMPLATES.tier_upgrade({
    customerName: account.customerName,
    oldTier,
    // R61: slovenski label nivoja ("silver" → "Srebrni") — prej je SMS
    // odhajal z raw ang. imenom ("…na silver nivo")
    newTier: tierLabelSi(newTier),
  })

  await sendLoyaltySms(account.customerPhone, message, 'tier_upgrade', loyaltyAccountId, config)
  logger.info('LoyaltyAuto', `Tier upgrade SMS sent to ${account.customerPhone}: ${oldTier} → ${newTier}`)
}

// 2. REWARD UNLOCKED — ko stranka doseže threshold za nagrado
export async function triggerRewardUnlocked(
  loyaltyAccountId: string,
  points: number,
  rewardDescription: string,
  config: LoyaltyAutomationConfig = DEFAULT_CONFIG,
): Promise<void> {
  if (!config.enabled || !config.triggers.rewardUnlocked) return

  const account = await db.loyaltyAccount.findUnique({
    where: { id: loyaltyAccountId },
  })
  if (!account || !account.customerPhone || !account.isActive) return

  const message = TEMPLATES.reward_unlocked({
    customerName: account.customerName,
    points,
    rewardDescription,
  })

  await sendLoyaltySms(account.customerPhone, message, 'reward_unlocked', loyaltyAccountId, config)
  logger.info('LoyaltyAuto', `Reward unlocked SMS sent to ${account.customerPhone} (${points} pts)`)
}

// --- R111 (LA-1, HIGH — TOCTOU/idempotenca razred iz R100–R110): dnevna ---
// --- idempotenca podelitve bonusa (advisory lock + tx-fresh re-check)   ---
//
// FORENZIKA: triggerBirthdayBonus / triggerWinback sta prej OBPOGOJENO
// ustvarila LoyaltyTransaction + incrementala pointsBalance ob VSAKEM
// klicu — brez kakršnekoli dedup zaščite:
//   (a) dvoklik na POST /api/loyalty-automation (admin UI) = DVOJNI bonus
//       (100/200 točk ×2) + duplirani audit;
//   (b) admin ∥ cron batch istočasno = oba batcha prebereta iste račune
//       (check-then-act na batch nivoju) → vsak račun dvakrat podeljen.
// SMS del je že dedupan prek outbox idempotencyKey-a
// (loyalty:{accountId}:{type}:{date}) — TOČKE niso bile.
// KANON: advisory lock 'loyalty-bonus:{id}:{type}:{date}' + Serializable tx +
// tx-fresh re-check (LoyaltyTransaction istega reason-a za današnji dan) →
// skip; podelitev (create + increment) pod ključavnico; SMS ŠELE PO commitu
// (nikoli zunanji klic pod ključavnico). P2034 = vzporedni batch je pravkar
// podelil → tretiraj kot skip (batch ne pada).

async function awardDailyBonusOnce(
  loyaltyAccountId: string,
  type: 'birthday_bonus' | 'winback',
  config: LoyaltyAutomationConfig,
): Promise<{ points: number; smsSent: boolean }> {
  const points = type === 'birthday_bonus' ? BIRTHDAY_BONUS_POINTS : WINBACK_BONUS_POINTS
  const reason = type === 'birthday_bonus' ? 'Rojstni dan bonus' : 'Win-back bonus'
  const todayKey = new Date().toISOString().slice(0, 10)
  const dayStart = new Date(`${todayKey}T00:00:00.000Z`)

  const account = await db.loyaltyAccount.findUnique({
    where: { id: loyaltyAccountId },
  })
  if (!account || !account.customerPhone || !account.isActive) return { points: 0, smsSent: false }

  let awarded = false
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`loyalty-bonus:${loyaltyAccountId}:${type}:${todayKey}`}))`
      // tx-fresh re-check — transakcija istega reason-a za današnji dan
      const existing = await tx.loyaltyTransaction.findFirst({
        where: {
          loyaltyAccountId,
          reason,
          createdAt: { gte: dayStart },
        },
      })
      if (existing) return
      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId,
          type: 'earn',
          points,
          reason,
          monetaryValue: 0,
        },
      })
      await tx.loyaltyAccount.update({
        where: { id: loyaltyAccountId },
        data: {
          pointsBalance: { increment: points },
          lifetimePoints: { increment: points },
        },
      })
      awarded = true
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      // Serializable konflikt = vzporedni batch je pravkar podelil bonus
      logger.warn('LoyaltyAuto', `Bonus award conflict (${type}) za ${loyaltyAccountId} — skip`)
      return { points: 0, smsSent: false }
    }
    throw err
  }

  if (!awarded) {
    logger.info('LoyaltyAuto', `Bonus ${type} za ${loyaltyAccountId} je danes že podeljen — skip (idempotenca)`)
    return { points: 0, smsSent: false }
  }

  // SMS ŠELE PO commitu (outbox idempotencyKey per-day dedup ostaja; zunanji
  // klic NIKOLI pod ključavnico)
  const message = type === 'birthday_bonus'
    ? TEMPLATES.birthday_bonus({ customerName: account.customerName })
    : TEMPLATES.winback({ customerName: account.customerName })
  await sendLoyaltySms(account.customerPhone, message, type, loyaltyAccountId, config)

  logger.info('LoyaltyAuto', `${type === 'birthday_bonus' ? 'Birthday' : 'Win-back'} bonus ${points} pts to ${account.customerPhone}`)
  return { points, smsSent: true }
}

// 3. BIRTHDAY BONUS — na rojstni dan stranke
export async function triggerBirthdayBonus(
  loyaltyAccountId: string,
  config: LoyaltyAutomationConfig = DEFAULT_CONFIG,
): Promise<{ points: number; smsSent: boolean }> {
  if (!config.enabled || !config.triggers.birthdayBonus) {
    return { points: 0, smsSent: false }
  }
  return awardDailyBonusOnce(loyaltyAccountId, 'birthday_bonus', config)
}

// 4. WINBACK — stranka je bila neaktivna > 60 dni
export async function triggerWinback(
  loyaltyAccountId: string,
  config: LoyaltyAutomationConfig = DEFAULT_CONFIG,
): Promise<{ points: number; smsSent: boolean }> {
  if (!config.enabled || !config.triggers.winback) {
    return { points: 0, smsSent: false }
  }
  return awardDailyBonusOnce(loyaltyAccountId, 'winback', config)
}

// 5. POINTS EXPIRING — 30 dni pred potekom
export async function triggerPointsExpiring(
  loyaltyAccountId: string,
  pointsExpiring: number,
  daysUntilExpiry: number,
  config: LoyaltyAutomationConfig = DEFAULT_CONFIG,
): Promise<void> {
  if (!config.enabled || !config.triggers.pointsExpiring) return
  if (pointsExpiring <= 0) return

  const account = await db.loyaltyAccount.findUnique({
    where: { id: loyaltyAccountId },
  })
  if (!account || !account.customerPhone || !account.isActive) return

  const message = TEMPLATES.points_expiring({
    customerName: account.customerName,
    points: pointsExpiring,
    daysUntilExpiry,
  })

  await sendLoyaltySms(account.customerPhone, message, 'points_expiring', loyaltyAccountId, config)
  logger.info('LoyaltyAuto', `Expiring points SMS to ${account.customerPhone} (${pointsExpiring} pts in ${daysUntilExpiry}d)`)
}

// 6. WELCOME — nova prijava v loyalty program
export async function triggerWelcome(
  loyaltyAccountId: string,
  config: LoyaltyAutomationConfig = DEFAULT_CONFIG,
): Promise<void> {
  if (!config.enabled || !config.triggers.welcome) return

  const account = await db.loyaltyAccount.findUnique({
    where: { id: loyaltyAccountId },
  })
  if (!account || !account.customerPhone || !account.isActive) return

  const message = TEMPLATES.welcome({
    customerName: account.customerName,
    points: account.pointsBalance,
  })

  await sendLoyaltySms(account.customerPhone, message, 'welcome', loyaltyAccountId, config)
  logger.info('LoyaltyAuto', `Welcome SMS to ${account.customerPhone}`)
}

// --- BATCH procesiranje (cron job) ---
// R86-4 (LOW): MANDATORY locationId (string | null) na vseh batch/stat funkcijah
// — null = super-admin/globalni cron pogled. Prej so batchi pošiljali SMS VSEM
// tenantom (cross-tenant SMS odhodi + točke na tujе račune!). Pogojni spread —
// NIKOLI { locationId: null }.

// Poišče vse stranke, ki jim je DANES (Europe/Ljubljana) rojstni dan.
//
// R143-b (epic #115 #30 — DENAR+SMS bug): prej je ta batch podelil 100 točk
// in rojstnodnevni SMS VSAKEMU aktivnemu računu s telefonsko številko ob
// VSAKEM dnevnem cronu (MVP hevristika brez birthday pogoja — zgodovinski
// komentar "v produkciji bi dodali birthday polje"). Rojstni dan ŽE OBSTAJA
// na Guest.birthday (prisma Guest) — povezava je SOFT-JOIN prek telefona:
//   LoyaltyAccount.customerPhone → Guest.phone
// z lokacijskim usklajevanjem po R143-a kontraktu (d): ujema Guest z
// guest.locationId === account.locationId ALI globalen gost (locationId
// null); brez ujemanja ALI brez rojstnega dneva → skip (števec
// skippedNoBirthday, brez napake). VIP soft-join precedent:
// src/app/api/reports/briefing/_helpers.ts (phone IN-list, select brez PII
// odgovora). Idempotenca podelitve ostane v awardDailyBonusOnce (advisory
// lock + tx-fresh re-check, R111) — ta batch odloča SAMO KDO je kandidat.
export async function processBirthdayBatch(config: LoyaltyAutomationConfig = DEFAULT_CONFIG, locationId: string | null) {
  const accounts = await db.loyaltyAccount.findMany({
    where: {
      isActive: true,
      customerPhone: { not: '' },
      // R86-4: pogojni spread — legacy NULL računi vidni samo super-adminu
      ...(locationId ? { locationId } : {}),
    },
    select: { id: true, customerName: true, customerPhone: true, locationId: true },
  })

  // Soft-join Guest po telefonu (ENA poizvedba na batch) — iz seznama
  // telefonov kandidatov. Guest.locationId NULL = globalen gost.
  const phones = [...new Set(accounts.map((a) => a.customerPhone).filter(Boolean))]
  const guests = phones.length > 0
    ? await db.guest.findMany({
        where: { phone: { in: phones } },
        select: { phone: true, birthday: true, locationId: true },
      })
    : []
  const guestsByPhone = new Map<string, { phone: string; birthday: Date | null; locationId: string | null }[]>()
  for (const g of guests) {
    const list = guestsByPhone.get(g.phone) ?? []
    list.push(g)
    guestsByPhone.set(g.phone, list)
  }

  /** Lokacijsko usklajen match: guest.locationId === account.locationId ALI
   *  globalen gost (null); prvi tak z zapisanim rojstnim dnem zmaga. */
  const birthdayForAccount = (accountLocationId: string | null, phone: string): Date | null => {
    const candidates = guestsByPhone.get(phone)
    if (!candidates) return null
    const match = candidates.find(
      (g) => (g.locationId === null || g.locationId === accountLocationId) && g.birthday != null,
    )
    return match ? match.birthday : null
  }

  // Števci odražajo DEJANSKE podelitve (awardDailyBonusOnce vrne points=0 na
  // idempotenten skip "že podeljeno danes") — prej je `sent` štel klice, zato
  // je ponovni isti-dnevni tek lažno poročal sent/pointsAwarded > 0.
  let sent = 0
  let pointsAwarded = 0
  let skippedNoBirthday = 0
  for (const account of accounts) {
    const birthday = birthdayForAccount(account.locationId ?? null, account.customerPhone)
    // 29. 2. ujema SAMO na 29. 2. (prestopno leto) — na neprestopnih letih NE
    // ujema 28. 2. (konservativna izbira, dokumentirana v lib/loyalty/birthday).
    if (!isBirthdayToday(birthday)) {
      skippedNoBirthday++
      continue
    }
    try {
      const award = await triggerBirthdayBonus(account.id, config)
      if (award.points > 0) {
        sent++
        pointsAwarded += award.points
      }
    } catch (err) {
      logger.error('LoyaltyAuto', `Birthday bonus failed for ${account.id}: ${err}`)
    }
  }

  return { processed: accounts.length, sent, skippedNoBirthday, pointsAwarded }
}

// Poišče stranke, ki so bile neaktivne > 60 dni
export async function processWinbackBatch(config: LoyaltyAutomationConfig = DEFAULT_CONFIG, locationId: string | null) {
  const cutoff = new Date(Date.now() - config.thresholds.winbackInactiveDays * 24 * 60 * 60 * 1000)

  // Poišči accounts brez transakcij po cutoff datumu
  const inactiveAccounts = await db.loyaltyAccount.findMany({
    where: {
      isActive: true,
      customerPhone: { not: '' },
      transactions: {
        none: {
          createdAt: { gte: cutoff },
        },
      },
      // R86-4: pogojni spread — NIKOLI { locationId: null }
      ...(locationId ? { locationId } : {}),
    },
    select: { id: true, customerName: true, customerPhone: true },
  })

  let sent = 0
  for (const account of inactiveAccounts) {
    try {
      await triggerWinback(account.id, config)
      sent++
    } catch (err) {
      logger.error('LoyaltyAuto', `Winback failed for ${account.id}: ${err}`)
    }
  }

  return { processed: inactiveAccounts.length, sent, pointsAwarded: sent * WINBACK_BONUS_POINTS }
}

// R143-b (epic #115 #30, kontrakt (c)): NOTIFY-ONLY pregled potečnih točk.
// Izračuna expiringSoon30d figuro z ISTIM FIFO približkom kot
// GET /api/loyalty/lifecycle (computeExpiringPoints — skupen vir). NE piše
// LoyaltyTransaction z type='expire' in NE decrementa balansov — to je
// DEFER na migracijo/business odločitev. Brez SMS strankam (nobenega
// outbox eventa) — rezultat je samo povzetek števcev za admin/ops odgovor.
export async function processExpiryNotifyBatch(locationId: string | null) {
  const summary = await computeExpiringPoints(locationId)
  logger.info(
    'LoyaltyAuto',
    `Expiry notify (notify-only): ${summary.accounts} računov, ${summary.points} točk poteče v 30 dneh` +
      `${summary.capped ? ` (cap dosežen, scanned ${summary.scanned})` : ''}`,
  )
  return {
    processed: summary.scanned,
    accountsExpiring: summary.accounts,
    expiringPoints: summary.points,
    capped: summary.capped,
    notifyOnly: true,
  }
}

// --- Pomožne funkcije ---

async function sendLoyaltySms(
  to: string,
  message: string,
  type: LoyaltyAutomationType,
  loyaltyAccountId: string,
  config: LoyaltyAutomationConfig,
): Promise<void> {
  // Pošlji preko outbox-a (č je SMS onemogočen, izpustimo)
  if (!config.smsEnabled) {
    logger.info('LoyaltyAuto', `SMS disabled — skipping ${type} for ${loyaltyAccountId}`)
    return
  }

  // Kreiraj outbox event za robustno dostavo
  await createOutboxEvent({
    aggregateType: 'customer',
    aggregateId: loyaltyAccountId,
    eventType: `loyalty_${type}`,
    payload: { to, body: message, type, loyaltyAccountId },
    target: 'sms',
    idempotencyKey: `loyalty:${loyaltyAccountId}:${type}:${new Date().toISOString().split('T')[0]}`,
  })

  // Takoj poskusi poslati (outbox je backup)
  try {
    const smsMessage: SmsMessage = { to, body: message }
    await sendSms(smsMessage)
  } catch (err) {
    logger.warn('LoyaltyAuto', `SMS direct send failed for ${to}, will retry via outbox: ${err}`)
  }
}

// --- Statistika ---
export async function getLoyaltyAutomationStats(locationId: string | null) {
  const totalAccounts = await db.loyaltyAccount.count({
    where: {
      isActive: true,
      ...(locationId ? { locationId } : {}), // R86-4: pogojni spread
    },
  })
  const accountsByTier = await db.loyaltyAccount.groupBy({
    by: ['tier'],
    where: {
      isActive: true,
      ...(locationId ? { locationId } : {}), // R86-4: pogojni spread
    },
    _count: { tier: true },
  })

  // Poišči inaktivne (>60 dni)
  const cutoff = new Date(Date.now() - WINBACK_INACTIVE_DAYS * 24 * 60 * 60 * 1000)
  const inactive = await db.loyaltyAccount.count({
    where: {
      isActive: true,
      customerPhone: { not: '' },
      transactions: { none: { createdAt: { gte: cutoff } } },
      ...(locationId ? { locationId } : {}), // R86-4: pogojni spread
    },
  })

  return {
    totalAccounts,
    inactive,
    accountsByTier: accountsByTier.map((t) => ({ tier: t.tier, count: t._count.tier })),
  }
}

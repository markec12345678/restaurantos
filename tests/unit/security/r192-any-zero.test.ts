// ============================================
// R192 — FULL SWEEP gate: no-explicit-any v src/ = 0
// (epik #144 P2 faza — tech debt sweep po koraku 23, zaključek ratcheta)
//
// R190 je očistil 40 supresij iz finančne jedre, R191 19 iz EOD komponent in
// FURS batch poti — preostalih 31 v 22 fajlih je R192 očistil do NULA:
//
//   (A) fallback-create vzorec (7): setup/init 5× + public/order 1× +
//       online-order create-order 1× — data literal z
//       `locationId: withLoc ? locationId : undefined` castan na UNCHECKED
//       create-input (Prisma.DiningOption/VoidReason/NoSaleReason/
//       PrepStationUncheckedCreateInput); vzorec dokumentiran v
//       src/lib/prisma-column-fallback.ts
//   (B) odvečni casti (5): kot $transaction + tx.kotDocument (2), fire-action
//       tx.kotDocument (1), scheduledEmailLog v scheduled-emails (1) in
//       lib/email (1) — generated client ima vse modele, casti stale
//   (C) DecimalLike kontrakt (5): payments reverseGiftCard/reverseLoyaltyPoints
//       (amount: number — reversalBase.amount = round2(...)), stock
//       PostCreationOrderData.total, qr-upsell price, cash-register
//       netPaymentAmount (strukturni { amount; refundAmount })
//   (D) Prisma boundary (4): post-handler nested create + course create
//       (OrderItemData.modifiersJson: string — schema stolpec je STRING,
//       zod z.string()), order-mutations created (OrderItemGetPayload
//       include menuItem), put-handler deliveryInfo (Json stolpec, kontrakt
//       { address: string })
//   (E) strukturni kontrakti (6): configuration item: unknown,
//       admin/migrate LocationBackfillDelegate (27 modelov; Shift namerno v
//       catch), redis-adapter eval v RedisClient interfacu, gift-cards
//       Create/Update/LoadGiftCardVariables
//   (F) seed orodja (5): InvItem Record<string, unknown>, CategoryRef/
//       ModifierRef index unknown, seed/route menuItems = Prisma MenuItem
//       vrstica, demo-data param DecimalLike
//
// Ta test uveljavlja:
//   1. vseh 22 R192 fajlov je ČISTIH (0 × supresija + 0 × psevdo-any tipov)
//   2. kanonski tipi/kontrakti so pinani v slice fajlih
//   3. GLOBALNI RATCHET = 0: skupno število no-explicit-any supresij v src/
//      je TOČNO 0 (90 pred R190 − 40 R190 − 19 R191 − 31 R192) — popoln sweep:
//      KATERAKOLI nova supresija v src/ prelomi ta test (usklajena pina ≤ 0
//      nosita tudi r190 in r191 testa)
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (...p: string[]): string => readFileSync(path.join(root, ...p), 'utf-8')

/** Poišči vse .ts/.tsx datoteke pod dir (rekurzivno). */
function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkTs(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/** Števi 'no-explicit-any' supresije v vseh src fajlih. */
function countAnySuppressions(): number {
  const srcDir = path.join(root, 'src')
  let count = 0
  for (const file of walkTs(srcDir)) count += (readFileSync(file, 'utf-8').match(/no-explicit-any/g) ?? []).length
  return count
}

/** Preštej psevdo-any anotacije/caste (`: any`, `as any`, `<any>`) v viru. */
function countPseudoAny(src: string): number {
  const annotations = src.match(/:\s*any\b/g) ?? []
  const casts = src.match(/\bas\s+any\b/g) ?? []
  const generics = src.match(/<any>/g) ?? []
  return annotations.length + casts.length + generics.length
}

// ─── R192 slice: 22 fajlov (25 supresij v (A)–(F) + eksplicitno omenjeni pomožniki) ───
const R192_FILES = [
  // (A) fallback-create vzorec
  'src/app/api/setup/init/route.ts',
  'src/app/api/public/order/route.ts',
  'src/app/api/public/online-order/_helpers/create-order.ts',
  // (B) odvečni casti — generated client
  'src/app/api/kot/route.ts',
  'src/app/api/orders/[id]/webhooks/handle-fire-action.ts',
  'src/app/api/scheduled-emails/create/route.ts',
  'src/lib/email/index.ts',
  // (C) DecimalLike kontrakt
  'src/app/api/payments/[id]/_helpers.ts',
  'src/app/api/orders/_helpers/stock.ts',
  'src/app/api/ai/qr-upsell/_helpers.ts',
  'src/app/api/cash-register/[id]/route.ts',
  // (D) Prisma boundary
  'src/app/api/orders/_helpers/post-handler.ts',
  'src/app/api/orders/_helpers/order-items.ts',
  'src/app/api/orders/[id]/_helpers/order-mutations.ts',
  'src/app/api/orders/[id]/_helpers/put-handler.ts',
  // (E) strukturni kontrakti
  'src/app/api/configuration/_helpers.ts',
  'src/app/api/admin/migrate/route.ts',
  'src/lib/cache/redis-adapter.ts',
  'src/components/pos/gift-cards/useGiftCardMutationHandlers.ts',
  // (F) seed orodja
  'src/app/api/seed-food-norms/helpers/types.ts',
  'src/app/api/seed-norms/helpers/types.ts',
  'src/app/api/seed/helpers/menu-items/types.ts',
  'src/app/api/seed/route.ts',
  'src/app/api/seed/helpers/demo-data.ts',
]

// pomožnika vzorca (brez supresij pred R192, a nosita kanonski dokument/kontrakt)
const R192_HELPERS = [
  'src/lib/prisma-column-fallback.ts',
]

describe('R192: R192 slice — nič supresij in nič psevdo-any (epik #144, sweep zaključek)', () => {
  for (const file of [...R192_FILES, ...R192_HELPERS]) {
    it(`${file}: 0 supresij + 0 psevdo-any`, () => {
      const src = read(file)
      expect(src.match(/no-explicit-any/g) ?? []).toEqual([])
      expect(countPseudoAny(src), `${file} vsebuje psevdo-any tip`).toBe(0)
    })
  }
})

describe('R192: kanonski tipi/kontrakti pinani v slice fajlih', () => {
  it('(A) fallback vzorec dokumentiran v prisma-column-fallback (unchecked create-input)', () => {
    const doc = read('src/lib/prisma-column-fallback.ts')
    expect(doc).toContain('UncheckedCreateInput')
    expect(doc).toContain('withLoc ? locationId : undefined')
    expect(doc).toContain('Run(false) veja NE sme podati locationId')
  })

  it('(A) setup/init: 4 kategorije create-inputov na unchecked varianti', () => {
    const src = read('src/app/api/setup/init/route.ts')
    expect(src).toContain('as Prisma.DiningOptionUncheckedCreateInput')
    expect(src).toContain('as Prisma.VoidReasonUncheckedCreateInput')
    expect(src).toContain('as Prisma.NoSaleReasonUncheckedCreateInput')
    expect(src).toContain('as Prisma.PrepStationUncheckedCreateInput')
  })

  it('(C) DecimalLike kontrakt: stock.total + qr-upsell.price + cash-register strukturni param', () => {
    expect(read('src/app/api/orders/_helpers/stock.ts')).toContain('total: DecimalLike')
    expect(read('src/app/api/ai/qr-upsell/_helpers.ts')).toContain('price: DecimalLike')
    expect(read('src/app/api/cash-register/[id]/route.ts')).toContain(
      '(p: { amount: DecimalLike; refundAmount?: DecimalLike | null })',
    )
    expect(read('src/app/api/payments/[id]/_helpers.ts')).toContain('amount: number')
  })

  it('(D) OrderItemData.modifiersJson = string (schema stolpec String + zod z.string())', () => {
    const orderItems = read('src/app/api/orders/_helpers/order-items.ts')
    expect(orderItems).toContain('modifiersJson?: string')
    expect(orderItems).toContain('z.string()')
    const mutations = read('src/app/api/orders/[id]/_helpers/order-mutations.ts')
    expect(mutations).toContain('Prisma.OrderItemGetPayload<{ include: { menuItem: true } }>')
  })

  it('(E) strukturni kontrakti: migrate delegate, redis eval, gift-card variables', () => {
    expect(read('src/app/api/admin/migrate/route.ts')).toContain('type LocationBackfillDelegate')
    expect(read('src/lib/cache/redis-adapter.ts')).toContain(
      'eval(script: string, numKeys: number, key: string, arg: number): Promise<[number, number]>',
    )
    const gift = read('src/components/pos/gift-cards/useGiftCardMutationHandlers.ts')
    expect(gift).toContain('export interface CreateGiftCardVariables')
    expect(gift).toContain('export interface UpdateGiftCardVariables extends Record<string, unknown>')
    expect(gift).toContain('export interface LoadGiftCardVariables')
    expect(gift).toContain('deleteMutate: (id: string) => void')
  })

  it('(F) seed: InvItem/CategRef index unknown + menuItems konkreten Prisma payload', () => {
    expect(read('src/app/api/seed-food-norms/helpers/types.ts')).toContain(
      'export type InvItem = Record<string, unknown> & { id: string }',
    )
    expect(read('src/app/api/seed-norms/helpers/types.ts')).toContain(
      'export type InvItem = Record<string, unknown> & { id: string }',
    )
    const menuTypes = read('src/app/api/seed/helpers/menu-items/types.ts')
    expect(menuTypes).toContain('export type CategoryRef = { id: string; [key: string]: unknown }')
    expect(menuTypes).toContain('export type ModifierRef = { id: string; [key: string]: unknown }')
    expect(read('src/app/api/seed/route.ts')).toContain(
      'Awaited<ReturnType<typeof db.menuItem.create>>[]',
    )
    expect(read('src/app/api/seed/helpers/demo-data.ts')).toContain('price: DecimalLike; vatRate: DecimalLike')
  })

  it('(B) casti odstranjene: kot/kotDocument + scheduledEmailLog na tipiziranem klientu', () => {
    expect(read('src/app/api/kot/route.ts')).toContain('await db.$transaction(async (tx) => {')
    expect(read('src/app/api/kot/route.ts')).toContain('await tx.kotDocument.create({')
    expect(read('src/app/api/orders/[id]/webhooks/handle-fire-action.ts')).toContain('await tx.kotDocument.create({')
    expect(read('src/app/api/scheduled-emails/create/route.ts')).toContain('await db.scheduledEmailLog.create({')
    expect(read('src/lib/email/index.ts')).toContain('await db.scheduledEmailLog.create({')
  })
})

describe('R192: GLOBALNI RATCHET — no-explicit-any v src/ = 0 (popoln sweep)', () => {
  it('skupno število supresij je TOČNO 0 (90 pred R190 − 40 R190 − 19 R191 − 31 R192)', () => {
    const count = countAnySuppressions()
    expect(
      count,
      'nova any supresija v src/ — ratchet = 0 prepoveduje VSAKO supresijo; tipiziraj z domenskim tipom (DecimalLike/strukturni kontrakt/Prisma payload), ne dodajaj supresije',
    ).toBe(0)
  })
})

describe('R192: IT-flake varovalka — Employee pin unikat (@default "") disciplina', () => {
  // Lekcija R192: test-admin fixture (r137/r140) je na create veji pustil pin ''
  // (@default, @unique) — ko je vitestov NE-determinističen vrstni red tekel
  // r137/r140 PRED r150, je r150-jev employee.create (prav tako default pin '')
  // trčil P2002 (nestabilna IT suita: ~50 % runov rdeča). Fixture create veja
  // mora reproducirati seed stanje (pin '1111'); per-run employee vrstice nosijo
  // RUN_ID pina (#133 norm).
  it('r137 ensureTestAdmin create veja ima pin 1111 (reproducira seed)', () => {
    const src = read('tests/integration/r137-delivery-driver.test.ts')
    expect(src).toContain("create: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: 'admin', status: 'active', pin: '1111' }")
  })

  it('r140 ensureTestAdmin create veja ima pin 1111 (reproducira seed)', () => {
    const src = read('tests/integration/r140-feedback.test.ts')
    expect(src).toContain("create: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: 'admin', status: 'active', pin: '1111' }")
  })

  it('r150 employee.create ima RUN_ID pin (#133 norm — brez default \'\')', () => {
    const src = read('tests/integration/r150-json-fields.test.ts')
    expect(src).toContain('pin: `pin-${RUN_ID}`')
  })
})

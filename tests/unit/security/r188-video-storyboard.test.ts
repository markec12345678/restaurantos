// ============================================
// r188-video-storyboard.test.ts — P2 korak 21 drift-gate (epik #144 / #141)
// ============================================
// #141 je dedicated video/presentation issue; epik #144 §21 korak 21 =
// "Finalize #141 product presentation/video". Odgovor v repozitoriju je
// docs/PRODUCT-VIDEO-STORYBOARD.md — storyboard, ki preslika §18 realno
// zgodbo (tla → miza → naročilo → … → poslovni pregled) na REALNE module
// (src/lib/modules/registry.ts) in REALNE komponente/rute.
//
// Ta drift-gate trajno uveljavlja P2 pravila prezentacije:
//   (a) POKRITOST: vsak registry modul (76) je v prilogi A (Da/Izbirno/Ne z
//       razlogom) — nič tiho izpuščeno (epik §21: no silently lost capability);
//   (b) REALNOST: vsaka omenjena screen/route pot obstaja na datotečnem
//       sistemu — storyboard opisuje resnično kodo, ne izmišljenih zaslonov;
//   (c) §18 NEGATIVNA PRAVILA: brez imen konkurence, brez primerjalnih
//       cenovnih trditev, narrativ brez tehničnih metrik (kot glavna zgodba);
//   (d) DEMO kredence: izrecno DEMO / TEST ONLY + demoPinPolicy;
//   (e) VIDEO-TUTORIALS.md je zgodovinski z DEMO markacijo in kazalcem na
//       storyboard (stari tehnični načrt ≠ produktni video).
// Krvavitev katerekoli točke = presentation drift — runda, ki doda/preimenuje
// modul ali spremeni javno fasado, MORA posodobiti storyboard (test faila).
// ============================================

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_GROUPS, MODULE_REGISTRY } from '@/lib/modules/registry'

const ROOT = process.cwd()
const SB_PATH = join(ROOT, 'docs/PRODUCT-VIDEO-STORYBOARD.md')
const VT_PATH = join(ROOT, 'docs/VIDEO-TUTORIALS.md')

const SB = readFileSync(SB_PATH, 'utf8')
const VT = readFileSync(VT_PATH, 'utf8')

/** Narrativ (scene S1–S16): od '## 3.' do '## 6.' — brez dokazne plastе. */
const NARRATIVE = SB.split('## 3.')[1]?.split('## 6.')[0] ?? ''

/** Vse backtick poti v dokumentu (src/… in tests/…). */
const REFERENCED_PATHS = [...SB.matchAll(/`((?:src|tests)\/[^`\s]+)`/g)].map((m) => m[1])

/** Stolpec 'V videu' iz priloge A. */
const DA_COUNT = (SB.match(/\| Da \(S/g) ?? []).length
const IZBIRNO_COUNT = (SB.match(/\| Izbirno/g) ?? []).length
const NE_COUNT = (SB.match(/\| Ne \|/g) ?? []).length

describe('R188 storyboard — obstoj, namen in runda', () => {
  it('storyboard obstaja in je P2 korak 21 (#141, epik #144, R188)', () => {
    expect(SB).toContain('PRODUCT VIDEO STORYBOARD')
    expect(SB).toContain('korak 21')
    expect(SB).toContain('#141')
    expect(SB).toContain('epik #144')
    expect(SB).toContain('R188')
  })

  it('glavna zgodba je epikova §18 realna zgodba (celotna sekvenca)', () => {
    expect(SB).toContain(
      'tla → miza → naročilo → kuhinja → priprava → plačilo → račun → izmena/poročanje → zaloge/nabava → food cost → analitika → poslovni pregled',
    )
  })

  it('pravila prezentacije §18/#141 so izrecno izpisana', () => {
    expect(SB).toContain('Uporabi dejanski RestaurantOS UI')
    expect(SB).toContain('Brez izmišljenih funkcij')
    expect(SB).toContain('Brez nepodprtih številk')
    expect(SB).toContain('Brez primerjav s konkurenco')
    expect(SB).toContain('Brez tehničnih metrik')
    expect(SB).toContain('Brez debug/internega UI')
    expect(SB).toContain('Brez naključnih osebnih')
    expect(SB).toContain('Realna uporabniška izkušnja')
  })

  it('produkcija standard #141: premium videz + cinematic stil', () => {
    expect(SB).toContain('Premium produktni videz')
    expect(SB).toContain('cinematic')
  })
})

describe('R188 storyboard — preslikava na realno kodo (registry + fs)', () => {
  it('VSAK registry modul (vseh 76) je omenjen kot `id` v prilogi A', () => {
    const missing = MODULE_REGISTRY.filter((m) => !SB.includes('`' + m.id + '`')).map((m) => m.id)
    expect(missing, 'manjkajoči moduli v prilogi A storyboarda').toEqual([])
  })

  it('vseh 7 skupin registry je pokritih (priloga A, stolpec Skupina)', () => {
    for (const g of MODULE_GROUPS) expect(SB).toContain(g.label)
  })

  it('priloga A šteje sodbе: 53 Da + 2 Izbirno + 21 Ne = 76 modulov', () => {
    expect(DA_COUNT + IZBIRNO_COUNT + NE_COUNT).toBe(MODULE_REGISTRY.length)
    expect(DA_COUNT).toBe(53)
    expect(IZBIRNO_COUNT).toBe(2)
    expect(NE_COUNT).toBe(21)
  })

  it('vsaka omenjena screen/route pot obstaja na datotečnem sistemu', () => {
    expect(REFERENCED_PATHS.length).toBeGreaterThan(60)
    const missing = REFERENCED_PATHS.filter((p) => !existsSync(join(ROOT, p)))
    expect(missing, 'neobstoječe poti v storyboardu').toEqual([])
  })

  it('ključne scene so pinane na registry module (kokpit → tla → naročilo → … → osebje)', () => {
    for (const id of [
      'danes',
      'floor-plan',
      'tables',
      'waitlist',
      'reservations',
      'orders',
      'kitchen',
      'kitchen-stations',
      'course-pacing',
      'cash-register',
      'furs',
      'end-of-day',
      'z-report',
      'shifts',
      'offline-queue',
      'menu',
      'recipes',
      'allergen-matrix',
      'inventory',
      'reorder-center',
      'suppliers',
      'food-cost',
      'menu-engineering',
      'dashboard',
      'reports',
      'advanced-analytics',
      'employees',
      'staff-schedule',
      'guests',
      'delivery',
    ]) {
      expect(SB).toContain('`' + id + '`')
    }
  })

  it('vse rute iz napravnega pregleda (S15/S16) obstajajo pod src/app', () => {
    for (const route of [
      'order',
      'order-status',
      'kds',
      'waiter',
      'kiosk',
      'qr',
      'qr-menu',
      'receipt',
      'display',
      'driver',
      'reserve',
    ]) {
      expect(existsSync(join(ROOT, 'src/app', route)), `ruta /${route}`).toBe(true)
    }
  })
})

describe('R188 storyboard — §18 negativna pravila (CI-uveljavljena)', () => {
  it('brez imen konkurence kjerkoli v storyboardu (pravilo #141)', () => {
    expect(SB).not.toMatch(/\b(toast|square|clover|lightspeed|touchbistro)\b/i)
  })

  it('brez primerjalnih cenovnih trditev ("ceneje od" ipd.)', () => {
    expect(SB).not.toMatch(/ceneje od|cheaper than|v primerjavi z/i)
  })

  it('narrativ (scene S1–S16) je brez tehničnih metrik — tehnika živi v prilogi B', () => {
    expect(NARRATIVE).toBeTruthy()
    expect(NARRATIVE).not.toMatch(/\b(testov|tests|vitest|spec|E2E|CI)\b/)
    expect(NARRATIVE).not.toMatch(/\d{3,}/)
  })

  it('demo kredence so izrecno označene DEMO / TEST ONLY + demoPinPolicy', () => {
    expect(SB).toContain('DEMO / TEST ONLY')
    expect(SB).toContain('demoPinPolicy')
    expect(SB).toContain('.env.example')
  })

  it('FURS omejitve so izrecno dokumentirane (epik §21), video ne trdi certifikacije', () => {
    expect(SB).toContain('produkcijska certifikacija je')
    expect(SB).toContain('pending')
    expect(SB).toContain('VALIDATION-MATRIX')
  })
})

describe('R188 — VIDEO-TUTORIALS zgodovinski banner', () => {
  it('stari tehnični načrt je zgodovinski + DEMO / TEST ONLY + kazalec na storyboard', () => {
    expect(VT).toContain('ZGODOVINSKI DOKUMENT')
    expect(VT).toContain('DEMO / TEST ONLY')
    expect(VT).toContain('PRODUCT-VIDEO-STORYBOARD.md')
    expect(VT).toContain('demoPinPolicy')
  })
})

import { describe, it, expect } from 'vitest'
import { calculateTier, tierProgress, tierRank, TIER_THRESHOLDS, tierEarnBonusPct, applyTierBonus, maybeTierUpgrade, tierLabelSi } from '@/lib/loyalty-tiers'

// R44: tier engine — pragovi po lifetimePoints (doslej zbrane točke).
// Pragovi: bronze 0, silver 500, gold 2000, platinum 5000.

describe('calculateTier', () => {
  it('vraca bronze za 0 in nizke vrednosti', () => {
    expect(calculateTier(0)).toBe('bronze')
    expect(calculateTier(1)).toBe('bronze')
    expect(calculateTier(499)).toBe('bronze')
  })

  it('vraca silver ob prag 500 (vkljucno)', () => {
    expect(calculateTier(500)).toBe('silver')
    expect(calculateTier(1999)).toBe('silver')
  })

  it('vraca gold ob prag 2000 in platinum ob 5000', () => {
    expect(calculateTier(2000)).toBe('gold')
    expect(calculateTier(4999)).toBe('gold')
    expect(calculateTier(5000)).toBe('platinum')
    expect(calculateTier(100000)).toBe('platinum')
  })

  it(' tolerantna do neveljavnih vhodov (NaN, negativno, decimalno)', () => {
    expect(calculateTier(NaN)).toBe('bronze')
    expect(calculateTier(-50)).toBe('bronze')
    expect(calculateTier(1234.9)).toBe('silver') // floor(1234.9)=1234
  })
})

describe('tierProgress', () => {
  it('bronze na 0: napredek 0 %, do silver manjka 500', () => {
    const p = tierProgress(0)
    expect(p.current).toBe('bronze')
    expect(p.next).toBe('silver')
    expect(p.pointsToNext).toBe(500)
    expect(p.progressPct).toBe(0)
    expect(p.nextThreshold).toBe(500)
  })

  it('sredina razpona: 250 tock = pol poti bronze→silver', () => {
    const p = tierProgress(250)
    expect(p.current).toBe('bronze')
    expect(p.next).toBe('silver')
    expect(p.pointsToNext).toBe(250)
    expect(p.progressPct).toBe(50)
  })

  it('silver gost: napredek merjen proti gold', () => {
    const p = tierProgress(1250)
    expect(p.current).toBe('silver')
    expect(p.next).toBe('gold')
    expect(p.pointsToNext).toBe(750)
    expect(p.progressPct).toBe(50) // (1250-500)/(2000-500)
  })

  it('gold gost: napredek merjen proti platinum', () => {
    const p = tierProgress(3500)
    expect(p.current).toBe('gold')
    expect(p.next).toBe('platinum')
    expect(p.pointsToNext).toBe(1500)
    expect(p.progressPct).toBe(50) // (3500-2000)/(5000-2000)
  })

  it('platinum: brez naslednjega nivoja, 100 %', () => {
    const p = tierProgress(99999)
    expect(p.current).toBe('platinum')
    expect(p.next).toBeNull()
    expect(p.pointsToNext).toBeNull()
    expect(p.progressPct).toBe(100)
    expect(p.nextThreshold).toBeNull()
  })

  it('napredek se ne zmanjsa z unovcenjem (pointsBalance ne vpliva)', () => {
    // lifetimePoints ostaja visok tudi ko je pointsBalance=0 (unovceno)
    expect(tierProgress(5200).current).toBe('platinum')
  })
})

describe('tierRank', () => {
  it('rangi naraščajo bronze→platinum, neznano ime → -1', () => {
    expect(tierRank('bronze')).toBe(0)
    expect(tierRank('silver')).toBe(1)
    expect(tierRank('gold')).toBe(2)
    expect(tierRank('platinum')).toBe(3)
    expect(tierRank('diamant')).toBe(-1)
    expect(tierRank('')).toBe(-1)
  })
})

describe('tierProgress — ročni override (upgrade-only)', () => {
  it('višji ročni nivo SE NE poniži: gold račun z 100 lifetime ostane gold', () => {
    const p = tierProgress(100, 'gold')
    expect(p.current).toBe('gold')
    expect(p.next).toBe('platinum')
    expect(p.pointsToNext).toBe(4900)
  })

  it('nižji/neznan ročni nivo NE vpliva: izračun je avtoriteta', () => {
    expect(tierProgress(3000, 'bronze').current).toBe('gold')
    expect(tierProgress(3000, 'neznano').current).toBe('gold')
  })
})

describe('TIER_THRESHOLDS', () => {
  it('je urejen narascajoce in zacne z 0', () => {
    expect(TIER_THRESHOLDS[0].minLifetime).toBe(0)
    for (let i = 1; i < TIER_THRESHOLDS.length; i++) {
      expect(TIER_THRESHOLDS[i].minLifetime).toBeGreaterThan(TIER_THRESHOLDS[i - 1].minLifetime)
    }
  })
})

// ─── RUNDA 45: bonus točk po nivoju (perk izkoriščanje) ───

describe('tierEarnBonusPct', () => {
  it('vraca 0 za bronze in neznan nivo', () => {
    expect(tierEarnBonusPct('bronze')).toBe(0)
    expect(tierEarnBonusPct('')).toBe(0)
    expect(tierEarnBonusPct('neznano')).toBe(0)
    expect(tierEarnBonusPct('GOLD')).toBe(0) // case-sensitive po zasnovi
  })

  it('vraca perk odstotke po nivojih (5/10/15)', () => {
    expect(tierEarnBonusPct('silver')).toBe(5)
    expect(tierEarnBonusPct('gold')).toBe(10)
    expect(tierEarnBonusPct('platinum')).toBe(15)
  })
})

describe('applyTierBonus', () => {
  it('bron: bonus 0, total = base', () => {
    const b = applyTierBonus(25, 'bronze')
    expect(b.base).toBe(25)
    expect(b.bonus).toBe(0)
    expect(b.total).toBe(25)
    expect(b.pct).toBe(0)
  })

  it('silver 5 %: floor zaokrozevanje navzdol', () => {
    const b = applyTierBonus(100, 'silver')
    expect(b).toEqual({ base: 100, bonus: 5, total: 105, pct: 5 })
    // 33 × 5 % = 1.65 → floor 1
    expect(applyTierBonus(33, 'silver').bonus).toBe(1)
  })

  it('gold 10 % in platinum 15 %', () => {
    expect(applyTierBonus(50, 'gold')).toEqual({ base: 50, bonus: 5, total: 55, pct: 10 })
    expect(applyTierBonus(200, 'platinum')).toEqual({ base: 200, bonus: 30, total: 230, pct: 15 })
    // 7 × 15 % = 1.05 → floor 1
    expect(applyTierBonus(7, 'platinum').bonus).toBe(1)
  })

  it('neveljavni vhodi: NaN/negativno → base 0, brez bonusa', () => {
    expect(applyTierBonus(NaN, 'platinum')).toEqual({ base: 0, bonus: 0, total: 0, pct: 0 })
    expect(applyTierBonus(-5, 'gold')).toEqual({ base: 0, bonus: 0, total: 0, pct: 0 })
    expect(applyTierBonus(0, 'gold')).toEqual({ base: 0, bonus: 0, total: 0, pct: 0 })
    // decimalni base → floor
    expect(applyTierBonus(10.9, 'gold')).toEqual({ base: 10, bonus: 1, total: 11, pct: 10 })
  })

  it('neznan nivo z veljavnim base → brez bonusa', () => {
    expect(applyTierBonus(100, 'nesmisel')).toEqual({ base: 100, bonus: 0, total: 100, pct: 0 })
  })
})

// ─── R61: zaključitev nivo toka — maybeTierUpgrade + tierLabelSi ───

describe('maybeTierUpgrade', () => {
  it('vraca visji nivo ko lifetime preseze prag', () => {
    expect(maybeTierUpgrade('bronze', 500)).toBe('silver')
    expect(maybeTierUpgrade('bronze', 543)).toBe('silver') // zivi dokaz: QA R42 Zvest
    expect(maybeTierUpgrade('silver', 2000)).toBe('gold')
    expect(maybeTierUpgrade('gold', 5000)).toBe('platinum')
  })

  it('vraca null pod pragom ali na istem nivoju (upgrade-only)', () => {
    expect(maybeTierUpgrade('bronze', 499)).toBeNull()
    expect(maybeTierUpgrade('silver', 500)).toBeNull() // isti nivo — ni napredovanja
    expect(maybeTierUpgrade('gold', 300)).toBeNull() // poniz je prepovedan
    expect(maybeTierUpgrade('platinum', 999999)).toBeNull() // zenska stekla
  })

  it('neznan trenutni nivo → null (ne uganjaj v rocni toki)', () => {
    expect(maybeTierUpgrade('nesmisel', 5000)).toBeNull()
    expect(maybeTierUpgrade('', 5000)).toBeNull()
  })

  it('neveljavni lifetime → null brez izjeme', () => {
    expect(maybeTierUpgrade('bronze', NaN)).toBeNull()
    expect(maybeTierUpgrade('bronze', -10)).toBeNull()
  })
})

describe('tierLabelSi', () => {
  it('pretvori imena nivojev v slovenske labele (ujemna s tierConfig UI)', () => {
    expect(tierLabelSi('bronze')).toBe('Bronasti')
    expect(tierLabelSi('silver')).toBe('Srebrni')
    expect(tierLabelSi('gold')).toBe('Zlati')
    expect(tierLabelSi('platinum')).toBe('Platinasti')
  })

  it('neznan nivo ostane nespremenjen (fallback)', () => {
    expect(tierLabelSi('diamond')).toBe('diamond')
    expect(tierLabelSi('')).toBe('')
  })
})

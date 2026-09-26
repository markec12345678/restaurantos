// ============================================
// R141-c — čisti UI helperji dnevnega pregleda (P2-28)
// Pure logika iz src/components/pos/briefing/constants.ts:
//   - BUG-04 badge mape: polni literal razredi + UNKNOWN fallback
//   - pokritost sl oznak (rezervacije / PO / vloge / izmene / Z / DailyClose)
//   - pomožniki: summarizeCovers, formatPctChange, daysToExpirySeverity,
//     formatDaysToExpiry, formatBriefingDateLabel, formatSlDateShort, roleLabel
// (brez renderinga — vzorec r140-feedback-status.test.ts)
// ============================================
import { describe, it, expect } from 'vitest'
import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_BADGES,
  RESERVATION_STATUS_UNKNOWN,
  LOW_STOCK_SEVERITY_BADGES,
  LOW_STOCK_SEVERITY_UNKNOWN,
  PO_STATUSES,
  PO_STATUS_BADGES,
  PO_STATUS_UNKNOWN,
  ROLES,
  ROLE_LABELS,
  SHIFT_TYPES,
  SHIFT_TYPE_BADGES,
  SHIFT_TYPE_UNKNOWN,
  SHIFT_STATUSES,
  SHIFT_STATUS_BADGES,
  SHIFT_STATUS_UNKNOWN,
  Z_REPORT_STATUSES,
  Z_REPORT_STATUS_BADGES,
  Z_REPORT_STATUS_UNKNOWN,
  DAILY_CLOSE_STATUSES,
  DAILY_CLOSE_STATUS_BADGES,
  DAILY_CLOSE_STATUS_UNKNOWN,
  PCT_TREND_BADGES,
  EXPIRY_SEVERITY_TEXT,
  summarizeCovers,
  formatPctChange,
  daysToExpirySeverity,
  formatDaysToExpiry,
  formatBriefingDateLabel,
  formatSlDateShort,
  roleLabel,
} from '@/components/pos/briefing/constants'

// ─── BUG-04 kanon: literal razredi, brez modrih/indigo, UNKNOWN fallback ───

const BADGE_MAPS = [
  ['RESERVATION_STATUS_BADGES', RESERVATION_STATUS_BADGES, RESERVATION_STATUS_UNKNOWN],
  ['PO_STATUS_BADGES', PO_STATUS_BADGES, PO_STATUS_UNKNOWN],
  ['SHIFT_TYPE_BADGES', SHIFT_TYPE_BADGES, SHIFT_TYPE_UNKNOWN],
  ['SHIFT_STATUS_BADGES', SHIFT_STATUS_BADGES, SHIFT_STATUS_UNKNOWN],
  ['Z_REPORT_STATUS_BADGES', Z_REPORT_STATUS_BADGES, Z_REPORT_STATUS_UNKNOWN],
  ['DAILY_CLOSE_STATUS_BADGES', DAILY_CLOSE_STATUS_BADGES, DAILY_CLOSE_STATUS_UNKNOWN],
] as const

describe('BUG-04 badge mape (dnevni pregled)', () => {
  it.each(BADGE_MAPS)('%s: vsi razredi so polni literali (brez konkatenacij/modrih tonov)', (_name, map, unknown) => {
    for (const cfg of Object.values(map)) {
      // polni literal razredi (bg + text prisotna, brez dinamičnih markerjev)
      expect(cfg.className).toMatch(/bg-[a-z]+-\d+/)
      expect(cfg.className).toMatch(/text-[a-z]+-\d+/)
      expect(cfg.className).not.toContain('${')
      expect(cfg.className).not.toContain('+')
      // hišno pravilo: NIKOLI modri/indigo akcenti
      expect(cfg.className).not.toMatch(/blue|indigo/)
    }
    // UNKNOWN fallback: nevtralen zinc, ne uhaja notranjih vrednosti
    expect(unknown.className).toMatch(/zinc/)
    expect(unknown.className).not.toMatch(/blue|indigo/)
    expect(unknown.label.length).toBeGreaterThan(0)
  })

  it('LOW_STOCK_SEVERITY ima unknown fallback z zinc razredom', () => {
    expect(LOW_STOCK_SEVERITY_BADGES.critical).toEqual({ label: 'Kritično', className: expect.stringContaining('red') })
    expect(LOW_STOCK_SEVERITY_BADGES.low).toEqual({ label: 'Nizko', className: expect.stringContaining('amber') })
    expect(LOW_STOCK_SEVERITY_UNKNOWN.className).toMatch(/zinc/)
  })

  it('PCT_TREND_BADGES pokrije vse tri trende z literal razredi (brez modrih)', () => {
    expect(Object.keys(PCT_TREND_BADGES).sort()).toEqual(['down', 'neutral', 'up'])
    expect(PCT_TREND_BADGES.up).toMatch(/emerald/)
    expect(PCT_TREND_BADGES.down).toMatch(/red/)
    expect(PCT_TREND_BADGES.neutral).toMatch(/zinc/)
    for (const cls of Object.values(PCT_TREND_BADGES)) {
      expect(cls).not.toMatch(/blue|indigo/)
      expect(cls).not.toContain('${')
    }
  })

  it('EXPIRY_SEVERITY_TEXT pokrije vse tri resnosti z literal razredi', () => {
    expect(EXPIRY_SEVERITY_TEXT.critical).toMatch(/red/)
    expect(EXPIRY_SEVERITY_TEXT.low).toMatch(/amber/)
    expect(EXPIRY_SEVERITY_TEXT.neutral).toBe('text-muted-foreground')
  })
})

// ─── Pokritost oznak (vsak kontraktni ključ ima sl oznako) ───

describe('sl oznake — pokritost kontraktnih ključev', () => {
  it('vsak status rezervacije ima badge', () => {
    for (const s of RESERVATION_STATUSES) {
      expect(RESERVATION_STATUS_BADGES[s], `manjka badge za ${s}`).toBeDefined()
    }
    expect(RESERVATION_STATUS_BADGES.confirmed.label).toBe('Potrjena')
    expect(RESERVATION_STATUS_BADGES.seated.label).toBe('Na mizi')
    expect(RESERVATION_STATUS_BADGES.cancelled.label).toBe('Odpovedana')
    expect(RESERVATION_STATUS_BADGES.no_show.label).toBe('Ni prišel')
  })

  it('vsak status naročilnice ima badge', () => {
    for (const s of PO_STATUSES) {
      expect(PO_STATUS_BADGES[s], `manjka badge za ${s}`).toBeDefined()
    }
    expect(PO_STATUS_BADGES.draft.label).toBe('Osnutek')
    expect(PO_STATUS_BADGES.submitted.label).toBe('Poslana')
    expect(PO_STATUS_BADGES.approved.label).toBe('Odobrena')
    expect(PO_STATUS_BADGES.partial.label).toBe('Delna')
  })

  it('vsaka vloga ima sl oznako', () => {
    for (const r of ROLES) {
      expect(ROLE_LABELS[r], `manjka oznaka za ${r}`).toBeDefined()
    }
    expect(ROLE_LABELS.server).toBe('Natakar')
    expect(ROLE_LABELS.dishwasher).toBe('Pomivalnik')
  })

  it('vsak tip izmene ima badge', () => {
    for (const t of SHIFT_TYPES) {
      expect(SHIFT_TYPE_BADGES[t], `manjka badge za ${t}`).toBeDefined()
    }
    expect(SHIFT_TYPE_BADGES.morning.label).toBe('Zjutraj')
    expect(SHIFT_TYPE_BADGES.split.label).toBe('Razdeljena')
  })

  it('vsak status izmene ima badge', () => {
    for (const s of SHIFT_STATUSES) {
      expect(SHIFT_STATUS_BADGES[s], `manjka badge za ${s}`).toBeDefined()
    }
  })

  it('statusa Z-poročila in dnevnega zaključka imata badge', () => {
    for (const s of Z_REPORT_STATUSES) {
      expect(Z_REPORT_STATUS_BADGES[s], `manjka badge za ${s}`).toBeDefined()
    }
    for (const s of DAILY_CLOSE_STATUSES) {
      expect(DAILY_CLOSE_STATUS_BADGES[s], `manjka badge za ${s}`).toBeDefined()
    }
    expect(DAILY_CLOSE_STATUS_BADGES.PENDING_APPROVAL.label).toBe('Čaka odobritev')
  })
})

// ─── Pomožniki ───

describe('summarizeCovers', () => {
  it('srečna pot: polni povzetek', () => {
    expect(summarizeCovers({ confirmed: 5, seated: 2, cancelled: 1, noShow: 0, totalGuests: 28 })).toEqual({
      expectedGuests: 28,
      reservationsToday: 5,
      seated: 2,
      cancelled: 1,
      noShow: 0,
    })
  })

  it('null/undefined → vse ničle (defenzivno)', () => {
    expect(summarizeCovers(null)).toEqual({ expectedGuests: 0, reservationsToday: 0, seated: 0, cancelled: 0, noShow: 0 })
    expect(summarizeCovers(undefined)).toEqual({ expectedGuests: 0, reservationsToday: 0, seated: 0, cancelled: 0, noShow: 0 })
  })

  it('nepopolni/napačni vhodi → 0 (ne crash, negativne zavrnjene)', () => {
    expect(summarizeCovers({})).toEqual({ expectedGuests: 0, reservationsToday: 0, seated: 0, cancelled: 0, noShow: 0 })
    expect(summarizeCovers({ confirmed: -3, totalGuests: Number.NaN }).reservationsToday).toBe(0)
    expect(summarizeCovers({ confirmed: -3 }).reservationsToday).toBe(0)
    expect(summarizeCovers({ totalGuests: Number.POSITIVE_INFINITY }).expectedGuests).toBe(0)
  })
})

describe('formatPctChange', () => {
  it('null/undefined/NaN → neutral črtica', () => {
    expect(formatPctChange(null)).toEqual({ label: '—', trend: 'neutral' })
    expect(formatPctChange(undefined)).toEqual({ label: '—', trend: 'neutral' })
    expect(formatPctChange(Number.NaN)).toEqual({ label: '—', trend: 'neutral' })
  })

  it('0 → neutral (brez lažnega signala)', () => {
    expect(formatPctChange(0)).toEqual({ label: '—', trend: 'neutral' })
  })

  it('pozitivno → up z plus znakom in vejico', () => {
    expect(formatPctChange(5)).toEqual({ label: '+5 %', trend: 'up' })
    expect(formatPctChange(12.34)).toEqual({ label: '+12,3 %', trend: 'up' })
    expect(formatPctChange(0.5)).toEqual({ label: '+0,5 %', trend: 'up' })
  })

  it('negativno → down s tipografskim minusom', () => {
    expect(formatPctChange(-3.2)).toEqual({ label: '−3,2 %', trend: 'down' })
    expect(formatPctChange(-100)).toEqual({ label: '−100 %', trend: 'down' })
  })
})

describe('daysToExpirySeverity', () => {
  it('≤1 dan → critical (vključno z 0 in negativnim)', () => {
    expect(daysToExpirySeverity(0)).toBe('critical')
    expect(daysToExpirySeverity(1)).toBe('critical')
    expect(daysToExpirySeverity(-2)).toBe('critical')
  })

  it('2–3 → low', () => {
    expect(daysToExpirySeverity(2)).toBe('low')
    expect(daysToExpirySeverity(3)).toBe('low')
  })

  it('>3 → neutral', () => {
    expect(daysToExpirySeverity(4)).toBe('neutral')
    expect(daysToExpirySeverity(30)).toBe('neutral')
  })

  it('null/undefined/NaN → neutral', () => {
    expect(daysToExpirySeverity(null)).toBe('neutral')
    expect(daysToExpirySeverity(undefined)).toBe('neutral')
    expect(daysToExpirySeverity(Number.NaN)).toBe('neutral')
  })
})

describe('formatDaysToExpiry', () => {
  it('0 / negativno / null → poteče danes (honesto)', () => {
    expect(formatDaysToExpiry(0)).toBe('poteče danes')
    expect(formatDaysToExpiry(-1)).toBe('poteče danes')
    expect(formatDaysToExpiry(null)).toBe('poteče danes')
    expect(formatDaysToExpiry(undefined)).toBe('poteče danes')
  })

  it('1 → poteče jutro', () => {
    expect(formatDaysToExpiry(1)).toBe('poteče jutro')
  })

  it('N → poteče čez N dni', () => {
    expect(formatDaysToExpiry(2)).toBe('poteče čez 2 dni')
    expect(formatDaysToExpiry(5)).toBe('poteče čez 5 dni')
  })
})

describe('formatBriefingDateLabel', () => {
  it('sobota 26. 9. 2026 → "Sobota, 26. 9. 2026"', () => {
    expect(formatBriefingDateLabel('2026-09-26')).toBe('Sobota, 26. 9. 2026')
  })

  it('znana mejna datuma (tedenski zamik pravilen)', () => {
    // 2026-01-01 je četrtek
    expect(formatBriefingDateLabel('2026-01-01')).toBe('Četrtek, 1. 1. 2026')
    // 2026-02-29 ne obstaja → surovi niz (ne crash, ne napačen dan)
    expect(formatBriefingDateLabel('2026-02-29')).toBe('2026-02-29')
  })

  it('neveljaven vhod → surovi niz', () => {
    expect(formatBriefingDateLabel('ni-datum')).toBe('ni-datum')
    expect(formatBriefingDateLabel('2026-13-40')).toBe('2026-13-40')
    expect(formatBriefingDateLabel('')).toBe('')
  })
})

describe('formatSlDateShort', () => {
  it('datum → "26. 9. 2026"; ISO datetime → samo datum', () => {
    expect(formatSlDateShort('2026-09-26')).toBe('26. 9. 2026')
    expect(formatSlDateShort('2026-09-26T19:00:00.000Z')).toBe('26. 9. 2026')
  })

  it('null / neveljaven → "—" (kanon odsotnih podatkov)', () => {
    expect(formatSlDateShort(null)).toBe('—')
    expect(formatSlDateShort(undefined)).toBe('—')
    expect(formatSlDateShort('garbage')).toBe('—')
    expect(formatSlDateShort('2026-02-30')).toBe('—')
  })
})

describe('roleLabel', () => {
  it('znana vloga → sl oznaka; neznana → surova vrednost', () => {
    expect(roleLabel('server')).toBe('Natakar')
    expect(roleLabel('chef')).toBe('Kuhar')
    expect(roleLabel('host')).toBe('Hostesa')
    expect(roleLabel('obsmeta')).toBe('obsmeta')
  })
})

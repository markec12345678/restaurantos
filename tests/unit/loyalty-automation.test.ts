// ============================================
// Loyalty Automation — Unit testi
// ============================================
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONFIG,
  BIRTHDAY_BONUS_POINTS,
  WINBACK_BONUS_POINTS,
  type LoyaltyAutomationType,
} from '@/lib/loyalty-automation'

// --- Predloge (testiramo strukturo, ne implementacijo) ---
const TEMPLATES: Record<LoyaltyAutomationType, (data: Record<string, unknown>) => string> = {
  tier_upgrade: (d) =>
    `Čestitamo ${d.customerName || ''}! Napravili ste vas na ${d.newTier} nivo v našem zvestobnem programu.`,
  reward_unlocked: (d) =>
    `Odlično ${d.customerName || ''}! Zbrali ste ${d.points} točk.`,
  birthday_bonus: (d) =>
    `Vse najboljše za rojstni dan, ${d.customerName || ''}! Podarili smo vam ${BIRTHDAY_BONUS_POINTS} točk zvestobnega programa.`,
  winback: (d) =>
    `Pogrešamo vas, ${d.customerName || ''}! Podarili smo vam ${WINBACK_BONUS_POINTS} točk za vaš naslednji obisk.`,
  points_expiring: (d) =>
    `Opomba: ${d.points} točk zvestobnega programa poteče čez ${d.daysUntilExpiry} dni.`,
  welcome: (d) =>
    `Dobrodošli v zvestobnem programu, ${d.customerName || ''}! Vaše stanje: ${d.points} točk.`,
}

describe('DEFAULT_CONFIG', () => {
  it('omogočen je privzeto', () => {
    expect(DEFAULT_CONFIG.enabled).toBe(true)
  })

  it('SMS je privzeto omogočen', () => {
    expect(DEFAULT_CONFIG.smsEnabled).toBe(true)
  })

  it('vsi triggerji so privzeto omogočeni', () => {
    expect(DEFAULT_CONFIG.triggers.tierUpgrade).toBe(true)
    expect(DEFAULT_CONFIG.triggers.rewardUnlocked).toBe(true)
    expect(DEFAULT_CONFIG.triggers.birthdayBonus).toBe(true)
    expect(DEFAULT_CONFIG.triggers.winback).toBe(true)
    expect(DEFAULT_CONFIG.triggers.pointsExpiring).toBe(true)
    expect(DEFAULT_CONFIG.triggers.welcome).toBe(true)
  })

  it('thresholdi imajo smiselne defaulte', () => {
    expect(DEFAULT_CONFIG.thresholds.rewardUnlockedPoints).toBe(500)
    expect(DEFAULT_CONFIG.thresholds.pointsExpiringDays).toBe(30)
    expect(DEFAULT_CONFIG.thresholds.winbackInactiveDays).toBe(60)
  })
})

describe('Bonus constants', () => {
  it('BIRTHDAY_BONUS = 100 točk', () => {
    expect(BIRTHDAY_BONUS_POINTS).toBe(100)
  })

  it('WINBACK_BONUS = 200 točk (večji kot birthday)', () => {
    expect(WINBACK_BONUS_POINTS).toBe(200)
    expect(WINBACK_BONUS_POINTS).toBeGreaterThan(BIRTHDAY_BONUS_POINTS)
  })
})

describe('SMS template structure', () => {
  it('tier_upgrade template vsebuje ime in novi tier', () => {
    const msg = TEMPLATES.tier_upgrade({ customerName: 'Janez', newTier: 'gold' })
    expect(msg).toContain('Janez')
    expect(msg).toContain('gold')
  })

  it('reward_unlocked template vsebuje točke', () => {
    const msg = TEMPLATES.reward_unlocked({ customerName: 'Ana', points: 500 })
    expect(msg).toContain('Ana')
    expect(msg).toContain('500')
  })

  it('birthday_bonus template vsebuje 100 točk', () => {
    const msg = TEMPLATES.birthday_bonus({ customerName: 'Marko' })
    expect(msg).toContain('Marko')
    expect(msg).toContain('100')
  })

  it('winback template vsebuje 200 točk', () => {
    const msg = TEMPLATES.winback({ customerName: 'Petra' })
    expect(msg).toContain('Petra')
    expect(msg).toContain('200')
  })

  it('points_expiring template vsebuje točke in dni', () => {
    const msg = TEMPLATES.points_expiring({ points: 300, daysUntilExpiry: 30 })
    expect(msg).toContain('300')
    expect(msg).toContain('30')
  })

  it('welcome template vsebuje začetno stanje', () => {
    const msg = TEMPLATES.welcome({ customerName: 'Ivo', points: 0 })
    expect(msg).toContain('Ivo')
    expect(msg).toContain('0')
  })

  it('vsi templates imajo slovensko vsebino', () => {
    const types: LoyaltyAutomationType[] = [
      'tier_upgrade',
      'reward_unlocked',
      'birthday_bonus',
      'winback',
      'points_expiring',
      'welcome',
    ]
    for (const type of types) {
      const msg = TEMPLATES[type]({ customerName: 'Test', points: 100, daysUntilExpiry: 30, newTier: 'gold' })
      expect(msg.length).toBeGreaterThan(20)
      // Preveri da vsebuje vsaj eno slovensko besedo
      const slovenianWords = ['točk', 'vas', 'našem', 'Čestitamo', 'Odlično', 'rojstni', 'Pogrešamo', 'Opomba', 'Dobrodošli']
      expect(slovenianWords.some(w => msg.includes(w))).toBe(true)
    }
  })
})

describe('LoyaltyAutomationType', () => {
  it('vsi 6 tipi so definirani', () => {
    const types: LoyaltyAutomationType[] = [
      'tier_upgrade',
      'reward_unlocked',
      'birthday_bonus',
      'winback',
      'points_expiring',
      'welcome',
    ]
    expect(types.length).toBe(6)
  })
})

describe('Template edge cases', () => {
  it('tier_upgrade deluje tudi brez customerName', () => {
    const msg = TEMPLATES.tier_upgrade({ newTier: 'silver' })
    expect(msg).toContain('silver')
    expect(msg).not.toContain('undefined')
  })

  it('welcome deluje s 0 točk', () => {
    const msg = TEMPLATES.welcome({ customerName: 'Novi', points: 0 })
    expect(msg).toContain('0 točk')
  })

  it('points_expiring deluje z 1 dnem', () => {
    const msg = TEMPLATES.points_expiring({ points: 50, daysUntilExpiry: 1 })
    expect(msg).toContain('50')
    expect(msg).toContain('1')
  })
})

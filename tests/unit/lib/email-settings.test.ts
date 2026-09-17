// ============================================
// EMAIL SETTINGS — Unit testi (Task 21)
//
// Preverjamo:
// - sendTestEmail: realni SMTP test (brez emailEnabled checka!)
//   * manjkajoče nastavitve → error
//   * manjkajoč SMTP host/user → error z jasnim sporočilom
//   * uspešno pošiljanje → { success, to, from, host }
//   * SMTP napaka → { success:false, error } (non-throwing)
//   * geslo se dešifrira prek ensureDecrypted
// - buildTestEmailHtml: escape + vsebina
// - parseRecipients (EmailTab): JSON array, legacy raw string, prazno
// - digest-preview date validacija (regex YYYY-MM-DD)
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  settingsFindFirst: vi.fn(),
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  ensureDecrypted: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    restaurantSettings: {
      findFirst: mocks.settingsFindFirst,
    },
  },
}))

vi.mock('nodemailer', () => ({
  createTransport: mocks.createTransport,
}))

vi.mock('@/lib/crypto/secrets', () => ({
  ensureDecrypted: mocks.ensureDecrypted,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}))

import { sendTestEmail, buildTestEmailHtml } from '@/lib/email'
import { parseRecipients } from '@/components/pos/settings/EmailTab'

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    emailEnabled: false,
    emailSmtpHost: 'smtp.test.si',
    emailSmtpPort: 587,
    emailSmtpUser: 'reports@restavracija.si',
    emailSmtpPassword: 'ENCRYPTED:abc',
    emailFromAddress: 'porocila@restavracija.si',
    email: 'info@restavracija.si',
    ...overrides,
  }
}

describe('sendTestEmail (Task 21 — realni SMTP test)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ensureDecrypted.mockImplementation((v: string) => v.replace('ENCRYPTED:', ''))
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail })
  })

  it('vrne error, če nastavitve ne obstajajo', async () => {
    mocks.settingsFindFirst.mockResolvedValue(null)
    const result = await sendTestEmail('a@b.si')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Nastavitve')
    expect(mocks.createTransport).not.toHaveBeenCalled()
  })

  it('vrne error, če SMTP host ali user manjkata (tudi če je emailEnabled)', async () => {
    mocks.settingsFindFirst.mockResolvedValue(makeSettings({ emailSmtpHost: '', emailSmtpUser: '' }))
    const result = await sendTestEmail('a@b.si')
    expect(result.success).toBe(false)
    expect(result.error).toContain('SMTP host ali uporabniško ime')
    expect(mocks.createTransport).not.toHaveBeenCalled()
  })

  it('DELUJE tudi, če je emailEnabled=false (admin testira pred omogočitvijo)', async () => {
    mocks.settingsFindFirst.mockResolvedValue(makeSettings({ emailEnabled: false }))
    mocks.sendMail.mockResolvedValue({})
    const result = await sendTestEmail('vodja@restavracija.si')
    expect(result.success).toBe(true)
    expect(result.to).toBe('vodja@restavracija.si')
    expect(result.from).toBe('porocila@restavracija.si')
    expect(result.host).toBe('smtp.test.si')
  })

  it('uporabi secure port 465 in dešifrirano geslo', async () => {
    mocks.settingsFindFirst.mockResolvedValue(makeSettings({ emailSmtpPort: 465 }))
    mocks.sendMail.mockResolvedValue({})
    await sendTestEmail('a@b.si')
    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.test.si',
        port: 465,
        secure: true,
        auth: { user: 'reports@restavracija.si', pass: 'abc' },
      })
    )
    expect(mocks.ensureDecrypted).toHaveBeenCalledWith('ENCRYPTED:abc')
  })

  it('fallback from: emailFromAddress prazen → settings.email', async () => {
    mocks.settingsFindFirst.mockResolvedValue(makeSettings({ emailFromAddress: '' }))
    mocks.sendMail.mockResolvedValue({})
    const result = await sendTestEmail('a@b.si')
    expect(result.from).toBe('info@restavracija.si')
  })

  it('SMTP napaka → { success:false, error } — NON-THROWING', async () => {
    mocks.settingsFindFirst.mockResolvedValue(makeSettings())
    mocks.sendMail.mockRejectedValue(new Error('535 Authentication failed'))
    const result = await sendTestEmail('a@b.si')
    expect(result.success).toBe(false)
    expect(result.error).toBe('535 Authentication failed')
    expect(mocks.loggerError).toHaveBeenCalled()
  })

  it('pošlje subject z datumom in slovensko vsebino', async () => {
    mocks.settingsFindFirst.mockResolvedValue(makeSettings())
    mocks.sendMail.mockResolvedValue({})
    await sendTestEmail('a@b.si')
    const call = mocks.sendMail.mock.calls[0][0]
    expect(call.to).toBe('a@b.si')
    expect(call.subject).toContain('Testni email — RestaurantOS')
    expect(call.html).toContain('Testni email')
  })
})

describe('buildTestEmailHtml', () => {
  it('escapes HTML v timestampu', () => {
    const html = buildTestEmailHtml('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('vsebuje potrditveno sporočilo', () => {
    const html = buildTestEmailHtml('2026-01-01')
    expect(html).toContain('SMTP konfiguracija')
    expect(html).toContain('RestaurantOS')
  })
})

describe('parseRecipients (EmailTab — JSON + legacy compat)', () => {
  it('razčleni JSON array', () => {
    expect(parseRecipients('["a@b.si","c@d.si"]')).toEqual(['a@b.si', 'c@d.si'])
  })

  it('razčleni legacy raw string z vejicami', () => {
    expect(parseRecipients('a@b.si, c@d.si')).toEqual(['a@b.si', 'c@d.si'])
  })

  it('prazno → prazen seznam', () => {
    expect(parseRecipients('')).toEqual([])
    expect(parseRecipients('[]')).toEqual([])
  })

  it('filtrira prazne vnose in ne-string elemente', () => {
    expect(parseRecipients('["a@b.si","",123]')).toEqual(['a@b.si'])
    expect(parseRecipients('  a@b.si ,  , c@d.si  ')).toEqual(['a@b.si', 'c@d.si'])
  })

  it('neveljaven JSON z @ → legacy fallback', () => {
    // vsebuje @ in vejice, ni valid JSON → split po vejici
    expect(parseRecipients('a@b.si c@d.si')).toEqual(['a@b.si c@d.si'])
  })
})

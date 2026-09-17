// ============================================
// CIS TAB — Unit testi (Task 24-c)
//
// Preverjamo čisto pomožno funkcijo mapCisEchoResponseToStatus
// (src/components/pos/settings/cis-status.ts), ki v useSettingsManager
// preslika odgovor GET /api/cis/echo v status povezave + toast sporočilo:
//   - reachable + echoed        → 'connected' + 'CIS Echo uspešen' + okolje
//   - reachable + !echoed (s006)→ 'connected' + 'dosegljiv' sporočilo
//   - !reachable                → 'error' + besedilo napake
//   - okolje/odzivni čas/manjkajoča polja (privzeti vzorci)
// ============================================

import { describe, it, expect } from 'vitest'
import { mapCisEchoResponseToStatus } from '@/components/pos/settings/cis-status'
import type { CisEchoResponse } from '@/components/pos/settings/cis-status'

/** Privzet uspešen echo odgovor (oblika iz /api/cis/echo) */
const baseEcho: CisEchoResponse = {
  environment: 'test',
  reachable: true,
  echoed: true,
  responseTime: 1075,
  httpStatus: 200,
}

describe('mapCisEchoResponseToStatus', () => {
  it('reachable + echoed → connected s sporočilom, ki vsebuje okolje in odzivni čas', () => {
    const { status, message } = mapCisEchoResponseToStatus(baseEcho)
    expect(status).toBe('connected')
    expect(message).toContain('CIS Echo uspešen')
    expect(message).toContain('TESTNO')
    expect(message).toContain('1075 ms')
  })

  it('produkcijsko okolje → oznaka PRODUKCIJA', () => {
    const { status, message } = mapCisEchoResponseToStatus({
      ...baseEcho,
      environment: 'production',
    })
    expect(status).toBe('connected')
    expect(message).toContain('PRODUKCIJA')
    expect(message).not.toContain('TESTNO')
  })

  it('reachable + !echoed + s006 → connected z "dosegljiv" sporočilom in kodo napake', () => {
    // s006 = pričakovana sistemska napaka za ne-podpisan echo (brez FINA P12)
    const { status, message } = mapCisEchoResponseToStatus({
      ...baseEcho,
      echoed: false,
      serverErrorCode: 's006',
    })
    expect(status).toBe('connected')
    expect(message).toContain('CIS dosegljiv')
    expect(message).toContain('strežnik živ, echo ni vračen')
    expect(message).toContain('s006')
    expect(message).not.toContain('Echo uspešen')
  })

  it('reachable + !echoed brez sistemske napake → connected brez kode', () => {
    const { status, message } = mapCisEchoResponseToStatus({
      ...baseEcho,
      echoed: false,
    })
    expect(status).toBe('connected')
    expect(message).toContain('CIS dosegljiv')
    expect(message).not.toContain('s0')
  })

  it('!reachable z napako → error z besedilom napake', () => {
    const { status, message } = mapCisEchoResponseToStatus({
      reachable: false,
      echoed: false,
      error: 'getaddrinfo ENOTFOUND cistest.apis-it.hr',
    })
    expect(status).toBe('error')
    expect(message).toContain('CIS povezava neuspešna')
    expect(message).toContain('getaddrinfo ENOTFOUND cistest.apis-it.hr')
  })

  it('!reachable brez napake → error s privzetim sporočilom', () => {
    const { status, message } = mapCisEchoResponseToStatus({
      reachable: false,
      echoed: false,
    })
    expect(status).toBe('error')
    expect(message).toBe('CIS povezava neuspešna')
  })

  it('manjkajoče okolje → privzeto TESTNO', () => {
    const { message } = mapCisEchoResponseToStatus({ ...baseEcho, environment: undefined })
    expect(message).toContain('TESTNO')
  })

  it('manjkajoč odzivni čas → sporočilo brez "ms"', () => {
    const { message } = mapCisEchoResponseToStatus({ ...baseEcho, responseTime: undefined })
    expect(message).not.toContain('ms')
  })
})

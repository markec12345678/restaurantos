// ============================================
// Webhook HMAC Signature — Unit testi
// Kritično za varnost Glovo/Wolt inbound webhooks
// ============================================
import { describe, it, expect } from 'vitest'
import { signPayload, verifySignature } from '@/lib/webhook-engine/signing'

const SECRET = 'test-webhook-secret-do-not-use-in-prod'

describe('webhook signPayload', () => {
  it('vrne string v formatu sha256=<hex>', () => {
    const sig = signPayload('hello', SECRET)
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it('vrne prazen string, če manjka secret', () => {
    expect(signPayload('hello', '')).toBe('')
  })

  it('je determinističen — isti payload + secret = isti podpis', () => {
    const sig1 = signPayload('{"order":"123"}', SECRET)
    const sig2 = signPayload('{"order":"123"}', SECRET)
    expect(sig1).toBe(sig2)
  })

  it('se spremeni, če se spremeni payload', () => {
    const sig1 = signPayload('{"order":"123"}', SECRET)
    const sig2 = signPayload('{"order":"124"}', SECRET)
    expect(sig1).not.toBe(sig2)
  })

  it('se spremeni, če se spremeni secret', () => {
    const sig1 = signPayload('hello', SECRET)
    const sig2 = signPayload('hello', 'different-secret')
    expect(sig1).not.toBe(sig2)
  })
})

describe('webhook verifySignature', () => {
  it('sprejme pravilen podpis', () => {
    const payload = '{"event":"order.created","id":"abc123"}'
    const sig = signPayload(payload, SECRET)
    expect(verifySignature(payload, sig, SECRET)).toBe(true)
  })

  it('zavrne napačen podpis', () => {
    const payload = '{"event":"order.created"}'
    const sig = 'sha256=deadbeef' // napačen
    expect(verifySignature(payload, sig, SECRET)).toBe(false)
  })

  it('zavrne podpis z napačnim secret-om', () => {
    const payload = '{"event":"order.created"}'
    const sig = signPayload(payload, 'wrong-secret')
    expect(verifySignature(payload, sig, SECRET)).toBe(false)
  })

  it('zavrne prazen podpis', () => {
    expect(verifySignature('hello', '', SECRET)).toBe(false)
  })

  it('zavrne prazen secret', () => {
    const sig = signPayload('hello', SECRET)
    expect(verifySignature('hello', sig, '')).toBe(false)
  })

  it('zavrne podpis brez sha256= prefix-a', () => {
    const payload = 'hello'
    const sig = 'abcdef0123456789' // brez prefix-a
    expect(verifySignature(payload, sig, SECRET)).toBe(false)
  })

  it('je odporen na timing attack (različne dolžine signature)', () => {
    // Kratek napačen podpis ne sme vrže napake — mora vrniti false
    const payload = 'hello'
    const shortWrongSig = 'sha256=abc'
    expect(verifySignature(payload, shortWrongSig, SECRET)).toBe(false)
  })

  it('deluje z real-world Glovo-style payload', () => {
    const glovoPayload = JSON.stringify({
      event: 'order.status.changed',
      order_id: 'GLV-12345',
      restaurant_id: 'REST-001',
      timestamp: '2026-07-14T19:30:00Z',
      data: { status: 'ready', total: 1550 },
    })
    const sig = signPayload(glovoPayload, SECRET)
    expect(verifySignature(glovoPayload, sig, SECRET)).toBe(true)
    // Sprememba ene števke v order_id mora zavrniti
    const tamperedPayload = glovoPayload.replace('GLV-12345', 'GLV-12346')
    expect(verifySignature(tamperedPayload, sig, SECRET)).toBe(false)
  })
})

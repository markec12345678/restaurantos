// ============================================
// CIS ECHO — Unit testi (Task 23)
//
// Preverjamo:
// - buildCisEchoEnvelope: SOAP struktura + namespace + echo niz
// - extractCisErrorCode: s006 iz odgovora, brez lažnih zadetkov
// - checkCisConnectivity (mock transport):
//   * echo round-trip → echoed=true, reachable=true
//   * s006 odgovor (ne-podpisan request) → reachable=true, echoed=false, s006
//   * HTML odgovor (ne-SOAP) → reachable=false z napako
//   * mrežna napaka (ENOTFOUND) → reachable=false, non-throwing
//   * timeout → reachable=false
//   * pravilen URL per okolje (test vs production) + ca samo za test
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  soapPost: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@/lib/cis/transport', () => ({
  soapPost: mocks.soapPost,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: mocks.loggerWarn,
    error: vi.fn(),
  },
}))

import { checkCisConnectivity, buildCisEchoEnvelope, extractCisErrorCode } from '@/lib/cis'
import { CIS_URLS, CIS_TEST_CA_PEM, CIS_PROD_CA_PEM } from '@/lib/cis'
const ECHO_MATCH = /restaurantos-ping-\d+/

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildCisEchoEnvelope', () => {
  it('vsebuje SOAP envelope, namespace in echo niz', () => {
    const xml = buildCisEchoEnvelope('ping-123')
    expect(xml).toContain('soapenv:Envelope')
    expect(xml).toContain('http://schemas.xmlsoap.org/soap/envelope/')
    expect(xml).toContain('http://www.apis-it.hr/fin/2012/types/fiskalizacija')
    expect(xml).toContain('<fu:EchoRequest>ping-123</fu:EchoRequest>')
  })
})

describe('extractCisErrorCode', () => {
  it('izlušči s006 iz odgovora', () => {
    expect(extractCisErrorCode('<SifraGreske>s006</SifraGreske>')).toBe('s006')
  })
  it('vrne undefined, če ni sistemske napake', () => {
    expect(extractCisErrorCode('<EchoResponse>ping-123</EchoResponse>')).toBeUndefined()
  })
  it('ne ujame pomanjkljivih kod (s00 = 2 številki, s0077 = 4)', () => {
    expect(extractCisErrorCode('s00 s0077 x')).toBeUndefined()
    expect(extractCisErrorCode('s00 s007 x')).toBe('s007')
  })
})

describe('checkCisConnectivity (mock transport)', () => {
  it('echo round-trip → echoed=true, reachable=true', async () => {
    const msg = `restaurantos-ping-${Date.now()}`
    mocks.soapPost.mockResolvedValue({
      status: 200,
      body: `<soap:Envelope><soap:Body><fu:EchoResponse>${msg}</fu:EchoResponse></soap:Body></soap:Envelope>`,
    })

    const res = await checkCisConnectivity('test')
    expect(res.reachable).toBe(true)
    expect(res.echoed).toBe(true)
    expect(res.responseTime).toBeGreaterThanOrEqual(0)
    expect(res.httpStatus).toBe(200)
    expect(mocks.soapPost).toHaveBeenCalledTimes(1)
    const [url, body] = mocks.soapPost.mock.calls[0]
    expect(url).toBe(CIS_URLS.test)
    expect(body).toMatch(ECHO_MATCH)
  })

  it('s006 odgovor (ne-podpisan request) → reachable=true, echoed=false, serverErrorCode', async () => {
    mocks.soapPost.mockResolvedValue({
      status: 500,
      body: '<soap:Envelope><soap:Body><Greske><SifraGreske>s006</SifraGreske></Greske></soap:Body></soap:Envelope>',
    })

    const res = await checkCisConnectivity('test')
    expect(res.reachable).toBe(true)
    expect(res.echoed).toBe(false)
    expect(res.serverErrorCode).toBe('s006')
    expect(res.error).toBeUndefined()
  })

  it('HTML odgovor (ne-SOAP) → reachable=false z razlago', async () => {
    mocks.soapPost.mockResolvedValue({ status: 502, body: '<html><body>Proxy error</body></html>' })

    const res = await checkCisConnectivity('test')
    expect(res.reachable).toBe(false)
    expect(res.echoed).toBe(false)
    expect(res.error).toContain('Nepričakovan odgovor')
    expect(res.httpStatus).toBe(502)
  })

  it('mrežna napaka → reachable=false, non-throwing', async () => {
    mocks.soapPost.mockRejectedValue(new Error('getaddrinfo ENOTFOUND cistest.apis-it.hr'))

    const res = await checkCisConnectivity('test')
    expect(res.reachable).toBe(false)
    expect(res.echoed).toBe(false)
    expect(res.error).toContain('ENOTFOUND')
    expect(mocks.loggerWarn).toHaveBeenCalled()
  })

  it('timeout → reachable=false', async () => {
    const abortError = new Error('The operation was aborted due to timeout')
    abortError.name = 'TimeoutError'
    mocks.soapPost.mockRejectedValue(abortError)

    const res = await checkCisConnectivity('production', { timeoutMs: 5 })
    expect(res.reachable).toBe(false)
    expect(res.error).toContain('aborted')
  })

  it('production URL različen od test; pravi CA per okolje', async () => {
    mocks.soapPost.mockResolvedValue({ status: 500, body: '<soap:Envelope><s006/></soap:Envelope>' })

    await checkCisConnectivity('test')
    expect(CIS_URLS.test).toContain('FiskalizacijaServiceTest')
    const testCall = mocks.soapPost.mock.calls[0]
    // 4. argument = options — ca je Fina Demo bundle (privatna demo hierarhija)
    expect((testCall[3] as { ca?: string }).ca).toBe(CIS_TEST_CA_PEM)

    await checkCisConnectivity('production')
    const prodCall = mocks.soapPost.mock.calls[1]
    expect(prodCall[0]).toBe(CIS_URLS.production)
    expect(CIS_URLS.production).toContain('cis.porezna-uprava.hr')
    // produkcija = Fina RDC 2020 intermediate (prod strežnik ne pošilja chain-a)
    expect((prodCall[3] as { ca?: string }).ca).toBe(CIS_PROD_CA_PEM)
  })
})

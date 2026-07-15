// ============================================
// parseJsonBody — Unit testi
// DoS zaščita (body size limit) + XSS sanatizacija
// ============================================
import { describe, it, expect } from 'vitest'
import { parseJsonBody } from '@/lib/api-utils/request/parse-json-body'
import { DEFAULT_MAX_BODY_SIZE } from '@/lib/api-utils/request/body-reader'

// Helper: ustvari Request z JSON body-jem
function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('https://api.test/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: bodyStr,
  })
}

describe('parseJsonBody', () => {
  describe('veljaven JSON input', () => {
    it('uspešno pars-a preprost JSON objekt', async () => {
      const req = makeRequest({ name: 'Test', value: 42 })
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      expect(result.data).toEqual({ name: 'Test', value: 42 })
    })

    it('uspešno pars-a JSON array (FIX PR #7: ohrani array, ne pretvori v objekt)', async () => {
      const req = makeRequest([1, 2, 3, 'test'])
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      // Po FIX-u PR #7: array-i morajo ostati array-i (prej so se pretvorili v {"0":1,...})
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data).toEqual([1, 2, 3, 'test'])
    })

    it('uspešno pars-a gnezdene objekte', async () => {
      const req = makeRequest({ outer: { inner: { deep: { value: true } } } })
      const result = await parseJsonBody(req)
      expect(result.data).toEqual({ outer: { inner: { deep: { value: true } } } })
    })

    it('uspešno pars-a prazen objekt', async () => {
      const req = makeRequest({})
      const result = await parseJsonBody(req)
      expect(result.data).toEqual({})
    })

    it('uspešno pars-a številke in boolean-e', async () => {
      const req = makeRequest({ num: 3.14, bool: true, neg: -5, zero: 0 })
      const result = await parseJsonBody(req)
      expect(result.data).toEqual({ num: 3.14, bool: true, neg: -5, zero: 0 })
    })
  })

  describe('neveljaven JSON', () => {
    it('vrne 400 napako za neveljaven JSON', async () => {
      const req = makeRequest('not-a-json{{{')
      const result = await parseJsonBody(req)
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error!.status).toBe(400)
    })

    it('vrne 400 napako za prazen body', async () => {
      const req = new Request('https://api.test/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      })
      const result = await parseJsonBody(req)
      // Prazen body je neveljaven JSON (JSON.parse('') vrže napako)
      expect(result.error).toBeTruthy()
      expect(result.error!.status).toBe(400)
    })

    it('vrne 400 za JSON sintaktično napako (brez zaklepaja)', async () => {
      const req = makeRequest('{"key": "value"')
      const result = await parseJsonBody(req)
      expect(result.error).toBeTruthy()
      expect(result.error!.status).toBe(400)
    })
  })

  describe('DoS zaščita — body size limit', () => {
    it('privzeta omejitev je 1 MB', async () => {
      expect(DEFAULT_MAX_BODY_SIZE).toBe(1024 * 1024)
    })

    it('zavrne body, ki presega Content-Length (413)', async () => {
      // Lažni Content-Length header, velik > 1MB
      const smallBody = JSON.stringify({ small: 'data' })
      const req = new Request('https://api.test/endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(DEFAULT_MAX_BODY_SIZE + 1),
        },
        body: smallBody,
      })
      const result = await parseJsonBody(req)
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error!.status).toBe(413)
    })

    it('sprejme body natanko pri omejitvi (1 MB)', async () => {
      // Tukaj naredimo body, ki je blizu limita a pod njim
      // Testiramo, da je meja <= 1MB, ne manj
      const smallPayload = { data: 'x'.repeat(100) }
      const req = makeRequest(smallPayload, {
        'Content-Length': String(Buffer.byteLength(JSON.stringify(smallPayload))),
      })
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      expect(result.data).toEqual(smallPayload)
    })

    it('dovoli custom maxBodySize (manjši od default)', async () => {
      // Postavi zelo nizko mejo — 100 bytov
      const smallData = { x: 'a'.repeat(50) }
      const req = makeRequest(smallData)
      const result = await parseJsonBody(req, { maxBodySize: 10 })
      // Body (50+ znakov) presega 10 bytov
      expect(result.error).toBeTruthy()
      expect(result.error!.status).toBe(413)
    })
  })

  describe('XSS sanatizacija', () => {
    it('sanatizira <script> tag-e v stringih (privzeto)', async () => {
      const req = makeRequest({ name: '<script>alert(1)</script>' })
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      // Po sanatizaciji naj bi bil < ali > encodan
      const data = result.data as { name: string }
      expect(data.name).not.toContain('<script>')
    })

    it('onemogoči sanatizacijo z options.sanitize = false', async () => {
      const malicious = '<script>alert(1)</script>'
      const req = makeRequest({ name: malicious })
      const result = await parseJsonBody(req, { sanitize: false })
      expect(result.error).toBeNull()
      const data = result.data as { name: string }
      // Brez sanatizacije se script tag ohrani
      expect(data.name).toBe(malicious)
    })

    it('sanatizira v gnezdenih objektih', async () => {
      const req = makeRequest({
        level1: {
          level2: {
            dangerous: '<img src=x onerror=alert(1)>',
          },
        },
      })
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      const data = result.data as { level1: { level2: { dangerous: string } } }
      expect(data.level1.level2.dangerous).not.toContain('onerror')
    })

    it('sanatizira v array elementih (FIX PR #7: array ostane array)', async () => {
      const req = makeRequest({
        items: ['<b>safe</b>', '<script>evil()</script>', 'plain text'],
      })
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      // Po FIX-u PR #7: items mora biti array, ne objekt s številskimi ključi
      const data = result.data as { items: string[] }
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items[0]).toBe('safe') // <b> odstranjen
      expect(data.items[1]).not.toContain('<script>')
      expect(data.items[2]).toBe('plain text')
    })
  })

  describe('edge cases', () => {
    it('sprejme null kot veljaven JSON', async () => {
      const req = makeRequest('null')
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      expect(result.data).toBeNull()
    })

    it('sprejme številko kot veljaven JSON', async () => {
      const req = makeRequest('42')
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      expect(result.data).toBe(42)
    })

    it('sprejme boolean kot veljaven JSON', async () => {
      const req = makeRequest('true')
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      expect(result.data).toBe(true)
    })

    it('sprejme JSON string', async () => {
      const req = makeRequest('"hello world"')
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      expect(result.data).toBe('hello world')
    })
  })

  describe('Content-Type header', () => {
    it('deluje tudi brez Content-Type header-ja', async () => {
      const req = new Request('https://api.test/endpoint', {
        method: 'POST',
        body: JSON.stringify({ ok: true }),
      })
      const result = await parseJsonBody(req)
      expect(result.error).toBeNull()
      expect(result.data).toEqual({ ok: true })
    })
  })
})

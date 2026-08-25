// ============================================
// SSRF Protection — Unit testi
// Preverja isInternalUrl() za preprečevanje SSRF napadov
// (outbound webhooks ne smejo kazati na interne naslove)
// ============================================
import { describe, it, expect } from 'vitest'
import { isInternalUrl } from '@/lib/webhook-engine/delivery/ssrf'

describe('isInternalUrl', () => {
  describe('zavrača notranje naslove', () => {
    it('zavrne localhost', () => {
      expect(isInternalUrl('http://localhost:3000/secret')).toBe(true)
      expect(isInternalUrl('http://localhost/admin')).toBe(true)
    })

    it('zavrne 0.0.0.0', () => {
      expect(isInternalUrl('http://0.0.0.0/')).toBe(true)
    })

    it('zavrne ::1 (IPv6 loopback)', () => {
      expect(isInternalUrl('http://[::1]/')).toBe(true)
    })

    it('zavrne celoten 127.x.x.x obseg (ne le 127.0.0.1)', () => {
      expect(isInternalUrl('http://127.0.0.1/')).toBe(true)
      expect(isInternalUrl('http://127.0.0.2/')).toBe(true)
      expect(isInternalUrl('http://127.1.2.3/')).toBe(true)
      expect(isInternalUrl('http://127.255.255.255/')).toBe(true)
    })

    it('zavrne IPv4-mapped IPv6 loopback (::ffff:127.x.x.x)', () => {
      expect(isInternalUrl('http://[::ffff:127.0.0.1]/')).toBe(true)
      expect(isInternalUrl('http://[::ffff:127.0.0.2]/')).toBe(true)
    })

    it('zavrne link-local 169.254.x.x', () => {
      expect(isInternalUrl('http://169.254.169.254/latest/meta-data/')).toBe(true) // AWS metadata
      expect(isInternalUrl('http://169.254.1.1/')).toBe(true)
    })

    it('zavrne IPv6 unique local fc00::/7', () => {
      expect(isInternalUrl('http://[fc00::1]/')).toBe(true)
      expect(isInternalUrl('http://[fd12:3456:789a::1]/')).toBe(true)
    })

    it('zavrne privatni 10.x.x.x', () => {
      expect(isInternalUrl('http://10.0.0.1/')).toBe(true)
      expect(isInternalUrl('http://10.255.255.255/')).toBe(true)
    })

    it('zavrne privatni 192.168.x.x', () => {
      expect(isInternalUrl('http://192.168.0.1/')).toBe(true)
      expect(isInternalUrl('http://192.168.1.100/')).toBe(true)
    })

    it('zavrne privatni 172.16-31.x.x', () => {
      expect(isInternalUrl('http://172.16.0.1/')).toBe(true)
      expect(isInternalUrl('http://172.31.255.255/')).toBe(true)
    })

    it('NE zavrne 172.32.x.x (out of private range)', () => {
      expect(isInternalUrl('http://172.32.0.1/')).toBe(false)
    })

    it('NE zavrne 172.15.x.x (out of private range)', () => {
      expect(isInternalUrl('http://172.15.0.1/')).toBe(false)
    })

    it('zavrne .local TLD', () => {
      expect(isInternalUrl('http://printer.local/')).toBe(true)
      expect(isInternalUrl('http://nas.local/admin')).toBe(true)
    })

    it('zavrne .internal TLD', () => {
      expect(isInternalUrl('http://api.internal/')).toBe(true)
    })

    it('zavrne .test TLD', () => {
      expect(isInternalUrl('http://myapp.test/')).toBe(true)
    })

    it('zavrne neveljaven URL', () => {
      expect(isInternalUrl('not-a-url')).toBe(true)
      expect(isInternalUrl('')).toBe(true)
      expect(isInternalUrl('://missing-protocol')).toBe(true)
    })
  })

  describe('dovoljuje javne naslove', () => {
    it('dovoli javni IPv4', () => {
      expect(isInternalUrl('http://8.8.8.8/dns')).toBe(false)
      expect(isInternalUrl('http://1.1.1.1/dns')).toBe(false)
      expect(isInternalUrl('http://203.0.113.1/')).toBe(false) // TEST-NET-3, ampak javni obseg
    })

    it('dovoli javni IPv6', () => {
      expect(isInternalUrl('http://[2606:4700:4700::1111]/')).toBe(false) // Cloudflare DNS
    })

    it('dovoli javno domeno', () => {
      expect(isInternalUrl('https://api.stripe.com/webhooks')).toBe(false)
      expect(isInternalUrl('https://api.openai.com/v1/chat')).toBe(false)
      expect(isInternalUrl('https://example.com/api')).toBe(false)
    })

    it('dovoli domeno z .com TLD (tudi če vsebuje "local" v imenu)', () => {
      expect(isInternalUrl('https://localhost-finder.com/')).toBe(false) // "localhost" je v imenu, a ne kot TLD
    })
  })

  describe('AWS metadata endpoint zaščita', () => {
    // Kritično: 169.254.169.254 je AWS/GCP/Azure metadata endpoint
    // Če webhook lahko dostopa do tega, napadalec lahko ukrade IAM credentials
    it('zavrne AWS metadata endpoint', () => {
      expect(isInternalUrl('http://169.254.169.254/latest/meta-data/iam/security-credentials/')).toBe(true)
      expect(isInternalUrl('http://169.254.169.254/latest/api/token')).toBe(true)
    })

    it('zavrne GCP metadata endpoint', () => {
      expect(isInternalUrl('http://metadata.google.internal/computeMetadata/v1/')).toBe(true) // .internal TLD
      expect(isInternalUrl('http://169.254.169.254/computeMetadata/v1/')).toBe(true)
    })

    it('zavrne Azure metadata endpoint', () => {
      expect(isInternalUrl('http://169.254.169.254/metadata/instance?api-version=2021-02-01')).toBe(true)
    })
  })
})

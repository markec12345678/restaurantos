// SSRF zaščita — preveri, ali URL kaže na notranji/lokalni naslov

/**
 * FIX MEDIUM: Preveri, ali URL kaže na notranji/lokalni naslov (SSRF zaščita)
 */
export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    // Lokalni naslovi
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1') {
      return true
    }
    // FIX HIGH: Celoten 127.x.x.x loopback obseg (ne le 127.0.0.1)
    if (/^127\./.test(hostname)) return true
    // FIX HIGH: IPv4-mapped IPv6 loopback
    if (/^::ffff:127\./.test(hostname)) return true
    // FIX HIGH: Link-local naslovi
    if (/^169\.254\./.test(hostname)) return true
    // FIX HIGH: IPv6 unique local (fc00::/7)
    if (/^f[cd]/.test(hostname)) return true
    // Privatni RFC1918 obsegi
    if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) {
      return true
    }
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
      return true
    }
    // .local, .internal, .test TLD
    if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.test')) {
      return true
    }
    return false
  } catch {
    return true // Neveljaven URL = zavrnjen
  }
}

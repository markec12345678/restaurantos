// ============================================
// CIS TRANSPORT — SOAP POST, runtime-aware (bun ↔ Node)
// ============================================
// TLS problem: CIS TESTNO okolje uporablja privatno Fina Demo CA, ki je ni v
// privzetem trust store-u. Rešitev je odvisna od runtime-a:
//   - bun (dev server):    fetch + { tls: { ca } }  (bun-specific opcija)
//   - Node (Vercel prod):  node:https request z { ca } (bunov node:https shim
//     ne podpira ca pravilno — "typo in url or port" napaka)
// Produkcija CIS ima javno CA verigo → ca je undefined → obe poti delujeta.
// ============================================

import { request as httpsRequest } from 'node:https'

export interface SoapPostOptions {
  ca?: string
  timeoutMs: number
}

export interface SoapPostResult {
  status: number
  body: string
}

/** Minimalni HTTPS POST prek node:https (Node runtime). */
function httpsPost(
  url: string,
  body: string,
  headers: Record<string, string>,
  options: SoapPostOptions
): Promise<SoapPostResult> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = httpsRequest(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers,
        ...(options.ca ? { ca: options.ca } : {}),
        timeout: options.timeoutMs,
      },
      res => {
        let data = ''
        res.on('data', (c: string | Buffer) => {
          data += c.toString()
        })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      }
    )
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout po ${options.timeoutMs} ms`))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/** Bun native fetch z tls.ca (bun runtime). */
async function bunFetchPost(
  url: string,
  body: string,
  headers: Record<string, string>,
  options: SoapPostOptions
): Promise<SoapPostResult> {
  // tls.ca ni v standardnem RequestInit tipu — bun-specific rozširitev
  const init = {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(options.timeoutMs),
    ...(options.ca ? { tls: { ca: options.ca } } : {}),
  }
  const res = await fetch(url, init as RequestInit)
  const text = await res.text()
  return { status: res.status, body: text }
}

/**
 * SOAP POST na CIS endpoint — izbere transport po runtime-u.
 * Deluje na bun (dev) in Node (Vercel prod).
 */
export function soapPost(
  url: string,
  body: string,
  headers: Record<string, string>,
  options: SoapPostOptions
): Promise<SoapPostResult> {
  const isBun = typeof globalThis !== 'undefined' && typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'
  if (isBun) {
    return bunFetchPost(url, body, headers, options)
  }
  return httpsPost(url, body, headers, options)
}

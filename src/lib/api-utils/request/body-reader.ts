// ============================================
// VARNOSTNO BRANJE JSON BODY-JA Z OMEJITVIJO
// Skupna logika za validateRequest in parseJsonBody
// ============================================

import { NextResponse } from 'next/server'
import { sanitizeValue } from '../../sanitize'
import { logger } from '../../logger'

/** Privzeta maksimalna velikost JSON body-ja (1 MB) */
export const DEFAULT_MAX_BODY_SIZE = 1024 * 1024

/**
 * Prebere JSON body iz zahtevka z omejitvijo velikosti (DoS zaščita),
 * nato ga sanatizira in vrne parsed objekt.
 *
 * @param req - Request objekt
 * @param options - Opcijske nastavitve
 * @returns Parsed in sanatiziran JSON objekt ali napako
 */
export async function readAndParseBody(
  req: Request,
  options?: {
    maxBodySize?: number
    sanitize?: boolean
  }
): Promise<
  | { data: unknown; error: null }
  | { data: null; error: NextResponse }
> {
  const maxBodySize = options?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE
  const shouldSanitize = options?.sanitize ?? true

  // 1. Preveri Content-Length header (hitra zavrnitev pred branjem bodyja)
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const length = parseInt(contentLength, 10)
    if (!isNaN(length) && length > maxBodySize) {
      logger.warn('API', `Zahteva presega omejitev velikosti: ${length} > ${maxBodySize}`)
      return {
        data: null,
        error: NextResponse.json(
          { error: 'Zahteva je prevelika. Največja dovoljena velikost je 1 MB.' },
          { status: 413 }
        ),
      }
    }
  }

  // 2. Preberi body z omejitvijo branjem
  let bodyText: string
  try {
    const reader = req.body?.getReader()
    if (!reader) {
      return {
        data: null,
        error: NextResponse.json({ error: 'Prazen body' }, { status: 400 }),
      }
    }

    const chunks: Uint8Array[] = []
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalSize += value.byteLength
      if (totalSize > maxBodySize) {
        reader.cancel().catch(() => {})
        logger.warn('API', `Body presega omejitev med branjem: ${totalSize} > ${maxBodySize}`)
        return {
          data: null,
          error: NextResponse.json(
            { error: 'Zahteva je prevelika. Največja dovoljena velikost je 1 MB.' },
            { status: 413 }
          ),
        }
      }
      chunks.push(value)
    }

    const combined = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.byteLength
    }
    bodyText = new TextDecoder().decode(combined)
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Napaka pri branju zahtevka' }, { status: 400 }),
    }
  }

  // 3. Razčleni JSON
  let body: unknown
  try {
    body = JSON.parse(bodyText)
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Neveljaven JSON format' }, { status: 400 }),
    }
  }

  // 4. Sanatiziraj stringe (XSS preprečevanje)
  // FIX (PR #7): Uporabimo sanitizeValue, ki pravilno ohrani array-e
  // na vrhnjem nivoju (prej je sanitizeObject pretvoril [1,2,3] v {"0":1,"1":2,"2":3})
  if (shouldSanitize && typeof body === 'object' && body !== null) {
    body = sanitizeValue(body)
  }

  return { data: body, error: null }
}

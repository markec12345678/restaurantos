// ============================================
// PARSANJE JSON BODY-JA Z OMEJITVIJO
// ============================================

import { NextResponse } from 'next/server'
import { DEFAULT_MAX_BODY_SIZE, readAndParseBody } from './body-reader'

/**
 * Prebere JSON body iz zahtevka z omejitvijo velikosti (DoS zaščita),
 * nato ga sanatizira in vrne parsed objekt.
 *
 * Uporablja se kot nadomestek za `await req.json()` v API rutah,
 * ki nato pokličejo `validateBody()`. Tako dobimo enako zaščito
 * kot `validateRequest()`, vendar z ločenimi koraki za boljšo
 * prilagodljivost.
 *
 * @param req - Request objekt
 * @param options - Opcijske nastavitve
 * @returns Parsed in sanatiziran JSON objekt ali napako
 */
export async function parseJsonBody(
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

  return readAndParseBody(req, { maxBodySize, sanitize: shouldSanitize })
}

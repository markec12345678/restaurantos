// ============================================
// VALIDACIJA ODHODNEGA ODZIVA IN BODY-JA (Response & Body Validation)
// Prepreči, da bi API vrnil napačno oblikovane podatke
// V development načinu vrže napako, v produkciji samo logira
// ============================================

import { NextResponse } from 'next/server'
import { ZodSchema } from 'zod'
import { sanitizeValue } from '../sanitize'
import { logger } from '../logger'

/**
 * Validira odhodni API odziv proti Zod shemi.
 * V development načinu (NODE_ENV !== 'production') vrže napako ob neuspehu —
 * to zagotovi, da razvijalec takoj zazna neskladje med shemo in podatki.
 * V produkciji samo logira opozorilo in vrne originalne podatke —
 * ne blokira delovanja sistema ob moremismatchu.
 *
 * @param data - Podatki, ki jih želimo validirati
 * @param schema - Zod shema za validacijo odziva
 * @param context - Kontekst za logiranje (npr. 'POST /api/payments')
 * @returns Validirani podatki ali originalni podatki (v produkciji ob neuspehu)
 */
export function validateApiResponse<T>(
  data: unknown,
  schema: ZodSchema<T>,
  context: string
): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
  const message = `[Response Validation] ${context} — shema se ne ujema s podatki: ${issues}`

  if (process.env.NODE_ENV !== 'production') {
    // V development načinu vrži napako — razvijalec mora popraviti shemo ali podatke
    throw new Error(message)
  }

  // V produkciji samo logiraj — ne blokiraj delovanja
  logger.warn(context, message)
  return data as T
}

/**
 * Enostavnejša različica za primere, ko želimo samo
 * prebrati in validirati JSON brez omejitve velikosti
 * (za zaupane notranje API klice).
 *
 * OPOMBA: Za nove rute priporočamo uporabo parseJsonBody() + validateBody()
 * namesto req.json() + validateBody(), da se zagotovi omejitev velikosti.
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown,
  options?: { sanitize?: boolean }
):
  | { data: T; error: null }
  | { data: null; error: NextResponse }
{
  const shouldSanitize = options?.sanitize ?? true

  // Sanatiziraj stringe
  // FIX (PR #7): sanitizeValue ohrani array-e na vrhnjem nivoju
  let processedBody = body
  if (shouldSanitize && typeof body === 'object' && body !== null) {
    processedBody = sanitizeValue(body)
  }

  const parsed = schema.safeParse(processedBody)
  if (!parsed.success) {
    return {
      data: null,
      error: NextResponse.json(
        {
          error: 'Neveljavni podatki',
          validationErrors: parsed.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      ),
    }
  }

  return { data: parsed.data, error: null }
}

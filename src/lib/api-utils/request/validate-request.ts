// ============================================
// VALIDACIJA ZAHTEVKA Z ZOD SHEMO
// ============================================

import { NextResponse } from 'next/server'
import { ZodSchema } from 'zod'
import { DEFAULT_MAX_BODY_SIZE, readAndParseBody } from './body-reader'

/**
 * Prebere in validira JSON body iz zahtevka z varnostnimi omejitvami:
 * 1. Omejitev velikosti body-ja (prepreči oversized payloads / DoS)
 * 2. Zod validacija strukture podatkov
 * 3. Samodejna sanatizacija stringov (XSS preprečevanje)
 *
 * @param req - Request objekt
 * @param schema - Zod shema za validacijo
 * @param options - Opcijske nastavitve
 * @returns Parsed in sanatized podatke ali napako
 */
export async function validateRequest<T>(
  req: Request,
  schema: ZodSchema<T>,
  options?: {
    maxBodySize?: number
    sanitize?: boolean
  }
): Promise<
  | { data: T; error: null }
  | { data: null; error: NextResponse }
> {
  const maxBodySize = options?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE
  const shouldSanitize = options?.sanitize ?? true

  const result = await readAndParseBody(req, { maxBodySize, sanitize: shouldSanitize })

  if (result.error) {
    return { data: null, error: result.error }
  }

  // Validiraj z Zod shemo
  const parsed = schema.safeParse(result.data)
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

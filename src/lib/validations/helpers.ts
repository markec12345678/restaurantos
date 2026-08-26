// ============================================
// POMOŽNE FUNKCIJE — Validacija telesa zahtevka, poročila, re-exporti
// ============================================

import { z } from 'zod'
import { NextResponse } from 'next/server'
import { sanitizeValue } from '../sanitize'

// ============================================
// HELPER: Varno parsnje z Zod
// ============================================

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { data: T; error: NextResponse | null } {
  // Sanatiziraj string vrednosti pred validacijo (XSS preprečevanje)
  // FIX (PR #7): sanitizeValue ohrani array-e na vrhnjem nivoju
  let processedBody = body
  if (typeof body === 'object' && body !== null) {
    processedBody = sanitizeValue(body)
  }

  const result = schema.safeParse(processedBody)
  if (!result.success) {
    const errors = result.error.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    return {
      data: null as T,
      error: NextResponse.json(
        { error: 'Neveljavni podatki', validationErrors: errors },
        { status: 400 }
      ),
    }
  }
  return { data: result.data, error: null }
}

// FIX HIGH: Helper za validacijo datumskega obsega poročil — prepreči prevelike poizvedbe
export function validateReportDateRange(startDate?: string | null, endDate?: string | null): NextResponse | null {
  // Če ni nobenega datuma, omejimo na zadnjih 366 dni
  if (!startDate && !endDate) {
    // Dovoljeno — privzeto bo route omejil na razumno obdobje
    return null
  }

  // Validiraj format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (startDate && !dateRegex.test(startDate)) {
    return NextResponse.json({ error: 'Začetni datum mora biti v formatu YYYY-MM-DD' }, { status: 400 })
  }
  if (endDate && !dateRegex.test(endDate)) {
    return NextResponse.json({ error: 'Končni datum mora biti v formatu YYYY-MM-DD' }, { status: 400 })
  }

  // Omejitev obdobja na 366 dni
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Neveljaven datum' }, { status: 400 })
    }
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 366) {
      return NextResponse.json({ error: 'Obdobje ne sme preseči 366 dni. Uporabite manjše obdobje.' }, { status: 400 })
    }
    if (diffDays < 0) {
      return NextResponse.json({ error: 'Začetni datum mora biti pred končnim' }, { status: 400 })
    }
  }

  // Prepreči poizvedbe pred letom 2020
  const minDate = new Date('2020-01-01')
  if (startDate && new Date(startDate) < minDate) {
    return NextResponse.json({ error: 'Začetni datum ne more biti pred 2020' }, { status: 400 })
  }

  return null
}

// Re-export iz api-utils za enostaven dostop iz API rut
export { validateRequest, parseJsonBody, validateApiResponse } from '../api-utils'

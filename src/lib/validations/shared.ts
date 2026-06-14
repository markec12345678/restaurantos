// ============================================
// SKUPNI TIPI — Skupne Zod pomožne sheme
// Uporabljajo se v vseh domenskih modulih
// ============================================

import { z } from 'zod'

export const positiveNumber = z.number().min(0.01, 'Vrednost mora biti pozitivna')
export const cuid = z.string().min(1, 'ID je obvezen')

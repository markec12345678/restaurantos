// ============================================
// DECIMAL TYPES — Skupni tipi za decimal modul
// ============================================

import { Prisma } from '@prisma/client'

export type DecimalLike = Prisma.Decimal | number | string | null | undefined

export { Prisma }

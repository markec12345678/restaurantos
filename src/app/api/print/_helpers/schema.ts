import { z } from 'zod'

// ============================================
// Zod validation schema for print requests
// ============================================

/** Zod validation schema for print requests */
export const printRequestSchema = z.object({
  type: z.enum(['order', 'receipt', 'test'], { message: 'Tip tiskanja mora biti order, receipt ali test' }),
  orderId: z.string().min(1, 'ID naročila je obvezen').max(100, 'ID naročila ne sme preseči 100 znakov').optional(),
  printerId: z.string().min(1, 'ID tiskalnika je obvezen').max(100, 'ID tiskalnika ne sme preseči 100 znakov').optional(),
}).refine(data => {
  // orderId je obvezen za order in receipt tip
  if ((data.type === 'order' || data.type === 'receipt') && !data.orderId) return false
  return true
}, { message: 'orderId je obvezen za tip order in receipt', path: ['orderId'] })

// Pomožne funkcije za Notifications API

import { z } from 'zod'

// Zod validacijska shema za pošiljanje obvestila
export const sendNotificationSchema = z.object({
  channel: z.enum(['sms', 'email', 'push'], { message: 'Kanal mora biti sms, email ali push' }),
  recipient: z.string().min(1, 'Prejemnik je obvezen').max(200, 'Prejemnik ne sme preseči 200 znakov'),
  subject: z.string().max(200, 'Zadeva ne sme preseči 200 znakov').default(''),
  message: z.string().min(1, 'Sporočilo je obvezno').max(5000, 'Sporočilo ne sme preseči 5000 znakov'),
  entityType: z.string().max(100, 'Tip entitete ne sme preseči 100 znakov').optional(),
  entityId: z.string().max(100, 'ID entitete ne sme preseči 100 znakov').optional(),
})

// Zod validacijska shema za množično pošiljanje
const batchNotificationItemSchema = z.object({
  channel: z.enum(['sms', 'email', 'push'], { message: 'Kanal mora biti sms, email ali push' }),
  recipient: z.string().min(1, 'Prejemnik je obvezen').max(200, 'Prejemnik ne sme preseči 200 znakov'),
  subject: z.string().max(200, 'Zadeva ne sme preseči 200 znakov').default(''),
  message: z.string().min(1, 'Sporočilo je obvezno').max(5000, 'Sporočilo ne sme preseči 5000 znakov'),
})

export const sendBatchSchema = z.object({
  notifications: z.array(batchNotificationItemSchema).min(1, 'Seznam obvestil je prazen').max(100, 'Največ 100 obvestil naenkrat'),
})

// Simulacija pošiljanja obvestila
export function simulateSend(channel: string): { success: boolean; providerId: string } {
  const providerId = `${channel}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return { success: true, providerId }
}

// Parse audit log details JSON
export function parseDetails(d: unknown): Record<string, unknown> {
  if (typeof d === 'string') {
    try { return JSON.parse(d) } catch { return {} }
  }
  return (d as Record<string, unknown>) || {}
}

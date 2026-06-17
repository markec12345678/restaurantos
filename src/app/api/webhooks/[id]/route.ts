import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// FIX HIGH: Zod validacija za posodobitev webhooka — prepreči injection
const updateWebhookSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200, 'Ime ne sme preseči 200 znakov').optional(),
  url: z.string().url('URL mora biti veljaven').max(500, 'URL ne sme preseči 500 znakov').optional(),
  events: z.string().max(2000, 'Dogodki ne smejo preseči 2000 znakov').optional(),
  isActive: z.boolean().optional(),
  secret: z.string().max(200, 'Skrivnost ne sme preseči 200 znakov').optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // AVTENTIKACIJA: Urejanje webhookov - samo admin
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params

    const result = await validateRequest(req, updateWebhookSchema)
    if (result.error) return result.error

    const data = result.data

    // Preveri, da webhook obstaja
    const existing = await db.webhook.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Webhook ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.url !== undefined) updateData.url = data.url
    if (data.events !== undefined) updateData.events = data.events
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.secret !== undefined) updateData.secret = data.secret

    const webhook = await db.webhook.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(webhook)
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/webhooks/[id]', 'Napaka pri posodobitvi webhooka')
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // AVTENTIKACIJA: Brisanje webhookov - samo admin
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params

    await db.webhook.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/webhooks/[id]', 'Napaka pri brisanju spletne kljuke')
  }
}

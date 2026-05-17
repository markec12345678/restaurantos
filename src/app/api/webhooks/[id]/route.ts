import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// FIX HIGH: Zod validacija za posodobitev webhooka — prepreči injection
const updateWebhookSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200).optional(),
  url: z.string().url('URL mora biti veljaven').max(500).optional(),
  events: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  secret: z.string().max(200).optional(),
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
    const body = await req.json()

    // FIX HIGH: Zod validacija namesto allowedFields pristopa
    const parsed = updateWebhookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Neveljavni podatki',
        validationErrors: parsed.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 })
    }
    const data = parsed.data

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
  } catch (error) {
    console.error('Failed to update webhook:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi webhooka' }, { status: 500 })
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
  } catch (error) {
    console.error('Failed to delete webhook:', error)
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 })
  }
}

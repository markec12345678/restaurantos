import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.url !== undefined) updateData.url = body.url
    if (body.events !== undefined) updateData.events = body.events
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.secret !== undefined) updateData.secret = body.secret
    if (body.lastTriggered !== undefined) updateData.lastTriggered = body.lastTriggered ? new Date(body.lastTriggered) : null
    if (body.failureCount !== undefined) updateData.failureCount = body.failureCount

    const webhook = await db.webhook.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(webhook)
  } catch (error) {
    console.error('Failed to update webhook:', error)
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await db.webhook.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete webhook:', error)
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 })
  }
}

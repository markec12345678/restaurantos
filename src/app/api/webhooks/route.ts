import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'

    const webhooks = await db.webhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(webhooks)
  } catch (error) {
    console.error('Failed to fetch webhooks:', error)
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const webhook = await db.webhook.create({
      data: {
        name: body.name,
        url: body.url,
        events: body.events || '[]',
        isActive: body.isActive !== undefined ? body.isActive : true,
        secret: body.secret || '',
        lastTriggered: body.lastTriggered ? new Date(body.lastTriggered) : null,
        failureCount: body.failureCount || 0,
      },
    })

    return NextResponse.json(webhook, { status: 201 })
  } catch (error) {
    console.error('Failed to create webhook:', error)
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 })
  }
}

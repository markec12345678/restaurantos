import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tier = searchParams.get('tier')
    const isActive = searchParams.get('isActive')
    const customerPhone = searchParams.get('customerPhone')

    const where: Record<string, unknown> = {}
    if (tier) where.tier = tier
    if (isActive !== null) where.isActive = isActive === 'true'
    if (customerPhone) where.customerPhone = customerPhone

    const accounts = await db.loyaltyAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Failed to fetch loyalty accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch loyalty accounts' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const account = await db.loyaltyAccount.create({
      data: {
        customerName: body.customerName || '',
        customerPhone: body.customerPhone || '',
        customerEmail: body.customerEmail || '',
        pointsBalance: body.pointsBalance || 0,
        lifetimePoints: body.lifetimePoints || 0,
        tier: body.tier || 'bronze',
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
      include: {
        transactions: true,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Failed to create loyalty account:', error)
    return NextResponse.json({ error: 'Failed to create loyalty account' }, { status: 500 })
  }
}

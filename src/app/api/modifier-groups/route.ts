import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const modifierGroups = await db.modifierGroup.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        modifiers: { orderBy: { sortOrder: 'asc' } },
        menuItems: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
      },
    })
    return NextResponse.json(modifierGroups)
  } catch (error) {
    console.error('Error fetching modifier groups:', error)
    return NextResponse.json({ error: 'Failed to fetch modifier groups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { modifiers, ...groupData } = body
    const modifierGroup = await db.modifierGroup.create({
      data: {
        name: groupData.name,
        required: groupData.required || false,
        minSelect: groupData.minSelect || 0,
        maxSelect: groupData.maxSelect || null,
        sortOrder: groupData.sortOrder || 0,
        modifiers: {
          create: (modifiers || []).map((m: { name: string; price: number; sortOrder: number }, i: number) => ({
            name: m.name,
            price: m.price || 0,
            sortOrder: m.sortOrder ?? i,
          })),
        },
      },
      include: { modifiers: true },
    })
    return NextResponse.json(modifierGroup, { status: 201 })
  } catch (error) {
    console.error('Error creating modifier group:', error)
    return NextResponse.json({ error: 'Failed to create modifier group' }, { status: 500 })
  }
}

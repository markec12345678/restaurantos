import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const menus = await db.menu.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            menuItems: {
              where: { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                modifierGroups: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    modifierGroup: {
                      include: {
                        modifiers: {
                          where: { isAvailable: true },
                          orderBy: { sortOrder: 'asc' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    return NextResponse.json(menus)
  } catch (error) {
    console.error('Error fetching menus:', error)
    return NextResponse.json({ error: 'Failed to fetch menus' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const menu = await db.menu.create({
      data: {
        name: body.name,
        icon: body.icon || '📋',
        color: body.color || '#f59e0b',
        sortOrder: body.sortOrder || 0,
        isActive: body.isActive !== false,
      },
    })
    return NextResponse.json(menu, { status: 201 })
  } catch (error) {
    console.error('Error creating menu:', error)
    return NextResponse.json({ error: 'Failed to create menu' }, { status: 500 })
  }
}

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const menuId = searchParams.get('menuId')

    let where = {}
    if (categoryId) {
      where = { categoryId }
    } else if (menuId) {
      where = { category: { menuId } }
    }

    const items = await db.menuItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        category: {
          include: { menu: { select: { id: true, name: true } } },
        },
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
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching menu items:', error)
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { modifierGroupIds, ...itemData } = body

    const item = await db.menuItem.create({
      data: {
        name: itemData.name,
        description: itemData.description || '',
        price: itemData.price,
        image: itemData.image || '',
        isAvailable: itemData.isAvailable ?? true,
        sortOrder: itemData.sortOrder || 0,
        categoryId: itemData.categoryId,
        ...(modifierGroupIds?.length ? {
          modifierGroups: {
            create: modifierGroupIds.map((groupId: string, i: number) => ({
              modifierGroupId: groupId,
              sortOrder: i,
            })),
          },
        } : {}),
      },
      include: {
        category: true,
        modifierGroups: {
          include: {
            modifierGroup: { include: { modifiers: true } },
          },
        },
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error creating menu item:', error)
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 })
  }
}

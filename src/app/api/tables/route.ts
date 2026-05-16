import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { validateBody, createTableSchema } from '@/lib/validations'

export async function GET() {
  const tables = await db.table.findMany({
    orderBy: { number: 'asc' },
    include: { orders: { where: { status: { in: ['pending', 'in-progress', 'ready'] } }, take: 1 } },
  })
  return NextResponse.json(tables)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(createTableSchema, body)
    if (validationError) return validationError

    const table = await db.table.create({
      data: {
        number: data.number,
        capacity: data.capacity,
        status: data.status,
        area: data.area,
        // Vizualni tloris — nove polja
        posX: body.posX ?? Math.random() * 70 + 5,
        posY: body.posY ?? Math.random() * 70 + 5,
        width: body.width ?? 8,
        height: body.height ?? 10,
        shape: body.shape ?? 'round',
        rotation: body.rotation ?? 0,
      },
    })
    return NextResponse.json(table, { status: 201 })
  } catch (error: any) {
    // SQLite unique constraint violation
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: `Miza s to številko že obstaja` },
        { status: 409 }
      )
    }
    console.error('Napaka pri ustvarjanju mize:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju mize' }, { status: 500 })
  }
}

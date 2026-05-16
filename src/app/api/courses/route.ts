import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json({ error: 'orderId je obvezen' }, { status: 400 });
    }

    const courses = await prisma.course.findMany({
      where: { orderId },
      include: { orderItems: { include: { menuItem: true } } },
      orderBy: { courseNumber: 'asc' },
    });

    return NextResponse.json(courses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const course = await prisma.course.create({
      data: {
        orderId: body.orderId,
        courseNumber: body.courseNumber || 1,
        name: body.name || '',
        status: 'pending',
        pacingNote: body.pacingNote || '',
      },
      include: { orderItems: true },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

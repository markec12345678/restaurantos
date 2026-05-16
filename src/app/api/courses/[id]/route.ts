import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: any = {};

    if (body.action === 'fire') {
      updateData.status = 'fired';
      updateData.firedAt = new Date();
      // Also update all order items in this course
      await prisma.orderItem.updateMany({
        where: { courseId: id },
        data: { status: 'fired' },
      });
    } else if (body.action === 'ready') {
      updateData.status = 'ready';
      updateData.readyAt = new Date();
      await prisma.orderItem.updateMany({
        where: { courseId: id },
        data: { status: 'ready' },
      });
    } else if (body.action === 'served') {
      updateData.status = 'served';
      updateData.servedAt = new Date();
      await prisma.orderItem.updateMany({
        where: { courseId: id },
        data: { status: 'served' },
      });
    } else {
      if (body.name !== undefined) updateData.name = body.name;
      if (body.courseNumber !== undefined) updateData.courseNumber = body.courseNumber;
      if (body.pacingNote !== undefined) updateData.pacingNote = body.pacingNote;
    }

    const course = await prisma.course.update({
      where: { id },
      data: updateData,
      include: { orderItems: { include: { menuItem: true } } },
    });

    return NextResponse.json(course);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Remove course from order items
    await prisma.orderItem.updateMany({
      where: { courseId: id },
      data: { courseId: null },
    });
    await prisma.course.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

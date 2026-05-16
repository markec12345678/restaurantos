import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: any = {};
    
    if (body.action === 'notify') {
      updateData.status = 'notified';
      updateData.notifiedAt = new Date();
    } else if (body.action === 'seat') {
      updateData.status = 'seated';
      updateData.seatedAt = new Date();
      updateData.tableId = body.tableId || null;
      // Calculate actual wait time
      const entry = await prisma.waitlistEntry.findUnique({ where: { id } });
      if (entry) {
        updateData.actualWaitMinutes = Math.round((Date.now() - entry.checkedInAt.getTime()) / 60000);
      }
    } else if (body.action === 'leave') {
      updateData.status = 'left';
      updateData.leftAt = new Date();
    } else if (body.action === 'cancel') {
      updateData.status = 'cancelled';
      updateData.leftAt = new Date();
    } else {
      // Direct update
      if (body.guestName) updateData.guestName = body.guestName;
      if (body.partySize) updateData.partySize = body.partySize;
      if (body.quotedWaitMinutes !== undefined) updateData.quotedWaitMinutes = body.quotedWaitMinutes;
      if (body.preferredArea !== undefined) updateData.preferredArea = body.preferredArea;
      if (body.specialNeeds !== undefined) updateData.specialNeeds = body.specialNeeds;
      if (body.notes !== undefined) updateData.notes = body.notes;
    }

    const entry = await prisma.waitlistEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(entry);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.waitlistEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

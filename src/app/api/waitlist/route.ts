import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const entries = await prisma.waitlistEntry.findMany({
      where: { status: { in: ['waiting', 'notified'] } },
      orderBy: { checkedInAt: 'asc' },
    });
    return NextResponse.json(entries);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = await prisma.waitlistEntry.create({
      data: {
        guestName: body.guestName,
        guestPhone: body.guestPhone || '',
        partySize: body.partySize,
        quotedWaitMinutes: body.quotedWaitMinutes || 0,
        preferredArea: body.preferredArea || '',
        specialNeeds: body.specialNeeds || '',
        status: 'waiting',
        notes: body.notes || '',
        employeeId: body.employeeId || null,
      },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

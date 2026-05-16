import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guest = await prisma.guest.findUnique({
      where: { id },
      include: {
        visits: { orderBy: { arrivedAt: 'desc' }, take: 20 },
        loyaltyAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { orderItems: { include: { menuItem: true } } },
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Gost ni najden' }, { status: 404 });
    }

    return NextResponse.json(guest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: any = {};
    
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.isVip !== undefined) {
      updateData.isVip = body.isVip;
      if (body.isVip && !updateData.vipSince) updateData.vipSince = new Date();
    }
    if (body.allergens !== undefined) updateData.allergens = JSON.stringify(body.allergens);
    if (body.dietaryPrefs !== undefined) updateData.dietaryPrefs = JSON.stringify(body.dietaryPrefs);
    if (body.dislikes !== undefined) updateData.dislikes = JSON.stringify(body.dislikes);
    if (body.favoriteItems !== undefined) updateData.favoriteItems = JSON.stringify(body.favoriteItems);
    if (body.birthday !== undefined) updateData.birthday = body.birthday ? new Date(body.birthday) : null;
    if (body.anniversary !== undefined) updateData.anniversary = body.anniversary ? new Date(body.anniversary) : null;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const guest = await prisma.guest.update({
      where: { id },
      data: updateData,
      include: { loyaltyAccount: true, visits: { take: 5, orderBy: { arrivedAt: 'desc' } } },
    });

    return NextResponse.json(guest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.guest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const vipOnly = searchParams.get('vip') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }
    
    if (vipOnly) {
      where.isVip = true;
    }

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        include: {
          visits: { orderBy: { arrivedAt: 'desc' }, take: 5 },
          loyaltyAccount: true,
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, orderNumber: true, total: true, createdAt: true, status: true }
          },
        },
        orderBy: { lastVisitAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.guest.count({ where }),
    ]);

    return NextResponse.json({ guests, total });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const guest = await prisma.guest.create({
      data: {
        firstName: body.firstName || '',
        lastName: body.lastName,
        email: body.email || '',
        phone: body.phone || '',
        isVip: body.isVip || false,
        vipSince: body.isVip ? new Date() : null,
        allergens: JSON.stringify(body.allergens || []),
        dietaryPrefs: JSON.stringify(body.dietaryPrefs || []),
        dislikes: JSON.stringify(body.dislikes || []),
        favoriteItems: JSON.stringify(body.favoriteItems || []),
        birthday: body.birthday ? new Date(body.birthday) : null,
        anniversary: body.anniversary ? new Date(body.anniversary) : null,
        company: body.company || '',
        notes: body.notes || '',
      },
      include: { loyaltyAccount: true },
    });

    return NextResponse.json(guest, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

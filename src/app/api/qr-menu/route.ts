import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Public QR Menu - no auth required
export async function GET() {
  try {
    const menus = await prisma.menu.findMany({
      where: { isActive: true },
      include: {
        categories: {
          include: {
            menuItems: {
              where: { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                modifierGroups: {
                  include: { modifierGroup: { include: { modifiers: { where: { isAvailable: true } } } } },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const settings = await prisma.restaurantSettings.findFirst();

    return Response.json({ menus, settings });
  } catch (error) {
    return Response.json({ error: 'Napaka pri nalaganju menija' }, { status: 500 });
  }
}

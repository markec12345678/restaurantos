import { db } from '@/lib/db';

// Public QR Menu - no auth required
export async function GET() {
  try {
    const menus = await db.menu.findMany({
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

    const settings = await db.restaurantSettings.findFirst();

    return Response.json({ menus, settings });
  } catch (error) {
    return Response.json({ error: 'Napaka pri nalaganju menija' }, { status: 500 });
  }
}

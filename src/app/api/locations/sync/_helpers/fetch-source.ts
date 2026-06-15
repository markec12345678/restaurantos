// Pomožne funkcije za Location Sync API — Pridobi podatke iz izvorne lokacije

import { db } from '@/lib/db'

// ─── Pridobi podatke iz izvorne lokacije ────────────────────

export async function fetchSourceMenus(sourceLocationId: string) {
  // FIX CRITICAL: Prejšnja koda je uporabila `data.sourceLocationId ? {} : {}` kar je VEDNO prazen filter!
  // To pomeni, da se sinhronizirajo VSI meniji iz VSEH lokacij namesto samo iz izvorne lokacije
  return db.menu.findMany({
    where: { locationId: sourceLocationId },
    include: {
      categories: {
        include: {
          menuItems: {
            include: {
              modifierGroups: {
                include: {
                  modifierGroup: {
                    include: {
                      modifiers: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })
}

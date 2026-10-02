
// GET /api/inventory/menu-stock — Hitri pregled zaloge za meni artikle (za POS indikatorje)
// Vrne mapo menuItemId → { status, available, unit } za prikaz na POS zaslonu
//
// R124 (P0-03): računanje PREMEŠČENO v enoten kanon
// src/lib/availability/menu-availability.ts (isti vir resnice kot QR/kiosk
// javni payloadi — kanon: POS kaže sold-out, QR ne sme sprejemati naročil).
// R124: permisija sproščena z ['take_orders', 'manage_inventory'] (OR) —
// prej je 'manage_inventory' blokiral natakarjem indikatorje zaloge.
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { computeMenuStockMap } from '@/lib/availability/menu-availability'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // R124 (P0-03): OR permisije — natakar (take_orders) potrebuje indikatorje
    // zaloge enako kot upravnik zaloge (manage_inventory)
    const authResult = await requireAuth(req, { permission: ['take_orders', 'manage_inventory'] })
    if (authResult.error) return authResult.error

    // #152 G1 (R211): session.locationId zoži direktni 1:1 link na PRAVO
    // lokacijo (P1-7: @@unique([menuItemId, locationId])) — mirror
    // deduct-direct.ts. Super-admin brez dodeljene lokacije (null) vidi
    // celoten tenant (obnašanje nespremenjeno).
    const locationId = authResult.session?.locationId ?? undefined
    const stockMap = await computeMenuStockMap({ locationId })

    return NextResponse.json(deepToNumbers(stockMap))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/inventory/menu-stock', 'Napaka pri pridobivanju zaloge menija')
  }
}

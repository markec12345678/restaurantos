// POST /api/menu-items/bulk-vat — Masovna sprememba DDV stopnje za vse artikle
//
// FIX NAPAKA 5 (HTTP 404): SettingsTab je klical ta endpoint, ki prej ni obstajal.
// Sedaj uporabnik lahko spremeni DDV stopnjo za vse artikle z določeno stopnjo na novo.
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { isAdminTenantRole } from '@/lib/tenant-scope'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bulkVatSchema = z.object({
  fromRate: z.number().min(0).max(100),
  toRate: z.number().min(0).max(100),
})

export async function POST(req: Request) {
  try {
    // Samo admin/manager lahko masovno spreminja DDV
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = validateBody(bulkVatSchema, bodyResult.data)
    if (error) return error

    const { fromRate, toRate } = data

    // Preveri če fromRate in toRate sta enaki — nič za narediti
    if (fromRate === toRate) {
      return NextResponse.json({ updated: 0, message: 'Source in target DDV stopnja sta enaki' })
    }

    // FIX R82-F (LEAK-HIGH): updateMany je bil GLOBALNO ({ vatRate: fromRate }
    // čez VSE tenante) — masovna DDV sprememba tujega menija. Zdaj: scoped na
    // session lokacijo (MenuItem → category.menu.locationId); staff/manager
    // brez lokacije → 403 fail-closed; super-admin = global.
    const sessionLocId = authResult.session?.locationId ?? null
    if (!sessionLocId && !isAdminTenantRole(authResult.session?.role)) {
      return NextResponse.json({ error: 'Masovna sprememba DDV zahteva dodeljeno lokacijo.' }, { status: 403 })
    }

    // Najdi vse artikle z fromRate DDV stopnjo in jih posodobi na toRate
    // Uporabimo transaction za konsistentnost
    const result = await db.menuItem.updateMany({
      where: {
        vatRate: fromRate,
        ...(sessionLocId ? { category: { menu: { locationId: sessionLocId } } } : {}),
      },
      data: {
        vatRate: toRate,
      },
    })

    return NextResponse.json({
      updated: result.count,
      fromRate,
      toRate,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/menu-items/bulk-vat', 'Napaka pri masovni spremembi DDV')
  }
}

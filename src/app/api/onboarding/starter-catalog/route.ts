// ============================================
// POST /api/onboarding/starter-catalog (issue #114)
// ============================================
// Idempotentna uporaba starter kataloga na lokaciji:
//  • FIRST-RUN: po /api/setup/init, če je bil izbran prazen katalog
//  • KASNEJE: iz praznega POS kataloga (StarterCatalogDialog)
//  • EXISTING CATALOG (§8): če lokacija že ima artikle, zahteva `confirm: true`
//
// Tenant/location isolation (§7): locationId se rešuje iz seje (canonical
// tenant-scope); super-admin lahko izrecno poda locationId. Fail-closed.
// Idempotency (§6): upsert/findFirst po naravnih ključih — retry/refresh/dvojni
// klik ne podvoji podatkov.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveCatalogScope, resolveWriteLocationId } from '@/lib/tenant-scope'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { applyStarterCatalog } from '@/lib/onboarding/catalog-templates/apply-starter-catalog'
import { VENUE_TYPE_IDS, getStarterTemplate } from '@/lib/onboarding/catalog-templates'
import type { VenueType } from '@/lib/onboarding/catalog-templates'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  venueType: z.enum(VENUE_TYPE_IDS),
  /** Izbirno za super-admina (brez seje lokacije); sicer ignorirano (seja avtoritativna). */
  locationId: z.string().trim().min(1).max(50).optional(),
  /** §8: lokacija z obstoječimi artikli zahteva eksplicitno potrditev. */
  confirm: z.boolean().default(false),
})

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimitAsync('onboarding-starter-catalog', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) {
      return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez trenutek.')
    }

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const { data, error } = bodySchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', validationErrors: error.issues },
        { status: 400 },
      )
    }

    const template = getStarterTemplate(data.venueType)
    if (!template) {
      return NextResponse.json({ error: 'Neznan tip lokala.' }, { status: 400 })
    }

    // MODEL A scope: seja (ali izrecni admin locationId) → konkretna lokacija
    const scopeRes = resolveCatalogScope(authResult)
    if (!scopeRes.ok) return scopeRes.response
    const writeRes = resolveWriteLocationId(scopeRes.scope, data.locationId)
    if (!writeRes.ok) return writeRes.response
    const locationId = writeRes.locationId

    // §8: zaščita obstoječega kataloga — brez `confirm` ne dodajamo template-a
    // lokaciji, ki že ima artikle (nadažni seed = tiha kontaminacija menija).
    const existingItemCount = await db.menuItem.count({
      where: { category: { menu: { locationId } } },
    })
    if (existingItemCount > 0 && !data.confirm) {
      return NextResponse.json(
        {
          error: 'Lokacija že ima artikle v katalogu. Potrdite, da želite dodati starter katalog.',
          existingItemCount,
        },
        { status: 409 },
      )
    }

    const result = await applyStarterCatalog({
      locationId,
      venueType: data.venueType as VenueType,
      db,
    })

    return NextResponse.json({
      success: true,
      template: result.template,
      menuName: result.menuName,
      created: result.created,
      totals: result.totals,
      skippedAttachments: result.skippedAttachments,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/onboarding/starter-catalog', 'Napaka pri ustvarjanju starter kataloga')
  }
}

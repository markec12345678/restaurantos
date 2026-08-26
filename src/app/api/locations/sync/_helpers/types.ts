// Pomožne funkcije za Location Sync API — Tipi in shema

import { z } from 'zod'

// ─── Tipi ───────────────────────────────────────────────────

export interface SyncResult {
  targetLocationId: string
  targetLocationName: string
  menusCreated: number
  categoriesCreated: number
  itemsCreated: number
  itemsUpdated: number
  modifiersCreated: number
  errors: string[]
}

export const locationSyncSchema = z.object({
  sourceLocationId: z.string().min(1, 'Izvorna lokacija je obvezna').max(100, 'ID lokacije je predolg'),
  targetLocationIds: z.array(z.string().max(100, 'ID lokacije je predolg')).min(1, 'Vsaj ena ciljna lokacija je obvezna').max(50, 'Največ 50 ciljnih lokacij'),
  syncMenuStructure: z.boolean().default(true),
  syncItems: z.boolean().default(true),
  syncPricing: z.boolean().default(false),
  syncModifiers: z.boolean().default(true),
  syncRecipes: z.boolean().default(false),
  dryRun: z.boolean().default(false),
})

export type LocationSyncData = z.infer<typeof locationSyncSchema>

// Pomožne funkcije za Location Sync API — Sinhronizacija menijev znotraj transakcije

import { db } from '@/lib/db'
import type { LocationSyncData, SyncResult } from './types'
import type { fetchSourceMenus } from './fetch-source'
import { batchFetchExistingEntities } from './batch-fetch'
import { syncLocationMenus } from './sync-logic'

// ─── Sinhronizacija znotraj transakcije ─────────────────────

export async function syncMenusToTargets(
  data: LocationSyncData,
  sourceMenus: Awaited<ReturnType<typeof fetchSourceMenus>>,
  targetLocations: Awaited<ReturnType<typeof db.location.findMany>>,
): Promise<SyncResult[]> {
  return db.$transaction(async (tx) => {
    // Batch pridobivanje obstoječih entitet (3 poizvedbe namesto N)
    const maps = await batchFetchExistingEntities(tx, data.targetLocationIds)

    // Sinhronizacija za vsako ciljno lokacijo
    const results: SyncResult[] = []
    for (const targetLocation of targetLocations) {
      const result = await syncLocationMenus(tx, data, sourceMenus, targetLocation, maps)
      results.push(result)
    }
    return results
  }, { timeout: 30000 })
}

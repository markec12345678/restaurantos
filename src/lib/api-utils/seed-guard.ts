// ============================================
// SEED GUARD — produkcijska zaščita seed endpointov
// ============================================
//
// P1 (seed & konfiguracija): seed endpointi morajo biti v produkciji:
//   - odstranjeni, ALI
//   - onemogočeni s compile-time flagom, ALI
//   - zaščiteni z ločenim administrativnim mehanizmom.
//
// Implementacija: fail-closed zavrnitev v produkciji. NODE_ENV Next.js
// inlinira ob build-u → efektivno compile-time zastavica; ekspliciten
// opt-in (SEED_ENABLED=true) obstaja samo za namenske demo namestitve
// (npr. staging demo instanca, ki NE hrani pravih podatkov).
//
// Poleg tega demo-data seed kreira zaposlene z demo PIN-i (1234/5678/...)
// vključno z admin vlogo — v produkciji je to direkten kompromis.
//

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export interface SeedGuardResult {
  allowed: boolean
  error?: NextResponse
}

/**
 * Preveri, ali je seed dovoljen v tem okolju.
 *
 * - development / test → dovoljen (demo PIN-i, cleanup — samo dev baze)
 * - production → ZAVRNJEN, razen če je SEED_ENABLED=true eksplicitno
 *   nastavljen (namenska demo namestitev brez produkcijskih podatkov)
 */
export function checkSeedAllowed(endpointName: string): SeedGuardResult {
  const isProduction = process.env.NODE_ENV === 'production'
  const explicitlyEnabled = process.env.SEED_ENABLED === 'true'

  if (isProduction && !explicitlyEnabled) {
    logger.error(
      'SEED',
      `[${endpointName}] Seed zavrnjen — NODE_ENV=production (SEED_ENABLED ni true). ` +
        'Seed briše podatke in ustvari demo PIN-e — v produkciji NE sme teči.',
    )
    return {
      allowed: false,
      error: NextResponse.json(
        {
          error:
            'Seed ni dovoljen v produkciji. Uporabite ločeno demo/staging okolje ' +
            '(ali nastavite SEED_ENABLED=true samo za demo namestitve brez pravih podatkov).',
        },
        { status: 403 },
      ),
    }
  }

  return { allowed: true }
}

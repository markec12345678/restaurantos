import { logger } from "@/lib/logger"
// ============================================
// VALIDACIJA OKOLJSKIH SPREMENLJIVK Z ZOD
// Fail-fast ob zagonu — prepreči runtime napake zaradi manjkajočih/napačnih env spremenljivk
// Uporaba: import { env } from '@/lib/env'
//
// P1 (seed & konfiguracija) — audit 2026-09-09:
//   RAZVRSTITEV spremenljivk v štiri skupine:
//     1. REQUIRED IN ALL ENVIRONMENTS   — DATABASE_URL
//     2. REQUIRED ONLY IN PRODUCTION    — NEXTAUTH_SECRET, ENCRYPTION_KEY
//        (superRefine: v produkciji manjkajoče → process.exit(1) — aplikacija
//        ZAVRNE start, namesto da bi tiho tekla z fallback skrivnostmi)
//     3. OPTIONAL (feature-gated)       — FURS cert, plačilni ključi, SMS,
//        webhook skrivnosti (logirajo CRITICAL opozorilo ob zagonu, a ne
//        ustavijo strežnika, ker so povezani z OPCIJONALNIMI funkcijami —
//        FURS konfiguracija je lahko tudi v DB prek config-resolverja)
//     4. DEVELOPMENT/TEST ONLY          — FURS_ALLOW_SIMULATION (default false)
// ============================================

import { z } from 'zod'

const envSchema = z
  .object({
    // ── 1. Obvezne v VSEH okoljih ─────────────
    DATABASE_URL: z.string().min(1, 'DATABASE_URL je obvezna — pot do PostgreSQL baze'),

    // ── 2. Obvezne SAMO v produkciji (superRefine spodaj) ──
    NEXTAUTH_SECRET: z.string().optional(),
    ENCRYPTION_KEY: z.string().optional(),

    // ── Javne spremenljivke (dostopne v brskalniku) ──
    NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL mora biti veljaven URL').default('http://localhost:3000'),

    // ── Izbirne spremenljivke ──────────────────
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    // ── AI ──
    GEMINI_API_KEY: z.string().optional(),

    // ── FURS ──
    // 4. TEST/DEV ONLY: eksplicitno omogoči simulacijo (default false —
    // production deploy s skopiranim .env.example NE more tiho simulirati)
    FURS_ALLOW_SIMULATION: z
      .enum(['true', 'false'])
      .default('false')
      .transform(v => v === 'true'),
    // 3. OPTIONAL (feature-gated): cert pot se lahko nahaja tudi v DB (Location)
    FURS_CERT_PATH: z.string().optional(),
    FURS_KEY_PATH: z.string().optional(),
    FURS_API_URL: z.string().url().optional(),
    FURS_TEST_API_URL: z.string().url().optional(),

    // ── WebSocket ──
    WS_PORT: z.coerce.number().int().min(1).max(65535).optional(),

    // ── Tiskalniki ──
    PRINTER_KITCHEN: z.string().optional(),
    PRINTER_BAR: z.string().optional(),
    PRINTER_RECEIPT: z.string().optional(),
    PRINTER_PORT: z.coerce.number().int().min(1).max(65535).optional(),

    // ── SMS / Email ──
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_PHONE_NUMBER: z.string().optional(),
    SENDGRID_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email().optional(),

    // ── Plačilni modul (3. OPTIONAL — potrebno samo ob aktivni integraciji) ──
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    WALLET_WEBHOOK_SECRET: z.string().optional(),

    // ── Dostava ──
    GLOVO_WEBHOOK_SECRET: z.string().optional(),
    WOLT_WEBHOOK_SECRET: z.string().optional(),
    BOLT_WEBHOOK_SECRET: z.string().optional(),

    // ── Multi-location ──
    DEFAULT_LOCATION_ID: z.string().optional(),

    // ── Varnost ──
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).optional(),
    SESSION_ABSOLUTE_TIMEOUT_HOURS: z.coerce.number().int().min(1).max(720).optional(),

    // ── Varnostne kopije ──
    BACKUP_INTERVAL_HOURS: z.coerce.number().int().min(0).optional(),
    BACKUP_PATH: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // ── 2. PRODUCTION-ONLY zahteve: fail-closed start ──
    if (env.NODE_ENV === 'production') {
      if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET.length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NEXTAUTH_SECRET'],
          message:
            'NEXTAUTH_SECRET je obvezen v produkciji (min 16 znakov) — seje, pinLookup ' +
            'HMAC in blockchain podpisi zahtevajo skrivnost. BREZ fallback-a.',
        })
      }
      if (!env.ENCRYPTION_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ENCRYPTION_KEY'],
          message:
            'ENCRYPTION_KEY je obvezen v produkciji (32-bajtni hex) — AES-256-GCM šifriranje ' +
            'skrivnosti v DB. BREZ fallback-a.',
        })
      }
      if (env.FURS_ALLOW_SIMULATION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FURS_ALLOW_SIMULATION'],
          message:
            'FURS_ALLOW_SIMULATION=true v produkciji ni dovoljen — davčne blagajne ne smejo ' +
            'simulirati fiskalizacije.',
        })
      }
    }
  })

/** Polja, katerih napaka pomeni KRITIČNO napako (ustavitev strežnika) */
const CRITICAL_FIELDS = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'ENCRYPTION_KEY', 'FURS_ALLOW_SIMULATION']

/**
 * 3. OPTIONAL (feature-gated) poverilnice — v produkciji se CRITICAL opozorilo
 * zapiše ob zagonu, a strežnik ne ustavi (povezane funkcije se same
 * fail-closed obravnavajo: npr. wallet webhook → 503 brez skrivnosti).
 */
function logProductionFeatureWarnings(data: {
  FURS_CERT_PATH?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  WALLET_WEBHOOK_SECRET?: string
  TWILIO_ACCOUNT_SID?: string
  SENDGRID_API_KEY?: string
}) {
  if (process.env.NODE_ENV !== 'production') return
  const warnings: string[] = []
  if (!data.FURS_CERT_PATH) {
    warnings.push('FURS_CERT_PATH manjka — če fiskalizacija ni konfigurirana prek DB (Location), bo FURS fail-closed (503).')
  }
  if (!data.STRIPE_SECRET_KEY || !data.STRIPE_WEBHOOK_SECRET) {
    warnings.push('Stripe ključi manjkajo — plačila s kartico/wallet bodo nedostopna.')
  }
  if (!data.WALLET_WEBHOOK_SECRET) {
    warnings.push('WALLET_WEBHOOK_SECRET manjka — gateway webhook-i bodo ZAVRNJENI (fail-closed 503).')
  }
  if (!data.TWILIO_ACCOUNT_SID || !data.SENDGRID_API_KEY) {
    warnings.push('SMS/Email poverilnice manjkajo — obvestila ne bodo poslana.')
  }
  if (warnings.length > 0) {
    logger.warn(
      'ENV',
      '⚠️ PRODUKCIJA: manjkajoče poverilnice za opcijsene funkcije (start se nadaljuje — ' +
        'prizadete funkcije so fail-closed):\n  ' +
        warnings.join('\n  '),
    )
  }
}

// ============================================
// PARSE IN VALIDACIJA — fail-fast ob zagonu
// ============================================

function parseEnv() {
  // V Next.js so env spremenljivke dostopne preko process.env
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.issues.map(
      issue => `  • ${issue.path.join('.')}: ${issue.message}`
    )
    // Kritična napaka = DATABASE_URL (vedno) ali production-only zahteva
    // (NEXTAUTH_SECRET / ENCRYPTION_KEY / simulacija v produkciji)
    const hasCriticalErrors = result.error.issues.some(
      issue => issue.path.length > 0 && CRITICAL_FIELDS.includes(String(issue.path[0]))
    )

    // V developmentu vrže podrobno napako, v produkciji le kritične
    if (hasCriticalErrors || process.env.NODE_ENV !== 'production') {
      logger.error(
        "CONSOLE",
        '\n❌ VALIDACIJA OKOLJSKIH SPREMENLJIVK JE SPODLETELA:\n' +
        errors.join('\n') +
        '\n\nProsimo, preverite .env datoteko glede na .env.example\n'
      )
    }

    // P1 (seed & konfig): aplikacija pri produkcijskem zagonu ZAVRNE start, če
    // manjkajo obvezne skrivnosti — NIKOLI ne teče z fallback vrednostmi.
    // Neobvezne spremenljivke strežnika ne ustavijo (niti v dev).
    if (hasCriticalErrors) {
      process.exit(1)
    }
  }

  let parsed: Env
  if (result.success) {
    parsed = result.data
  } else {
    // Ne-kritična napaka (neobvezno polje) — re-parse s privzetki.
    // P1: production-only skrivnosti se pri re-parse posredujo IZ process.env
    // (sicer bi superRefine lažno sprožil / fallback izgubil skrivnost).
    try {
      parsed = envSchema.parse({
        DATABASE_URL: process.env.DATABASE_URL || 'file:./db/custom.db',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        NODE_ENV: process.env.NODE_ENV || 'development',
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
        FURS_ALLOW_SIMULATION: process.env.FURS_ALLOW_SIMULATION || 'false',
      })
    } catch {
      // Zadnja varovalka — ne-kritična polja dobijo privzetke
      parsed = {
        DATABASE_URL: process.env.DATABASE_URL || 'file:./db/custom.db',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) || 'development',
        PORT: 3000,
        FURS_ALLOW_SIMULATION: false,
      } as Env
    }
  }

  // 3. OPTIONAL: produkcijska opozorila za feature-gated poverilnice
  logProductionFeatureWarnings(parsed)

  return parsed
}

// Singleton — izračuna se enkrat ob prvem uvozu
export const env = parseEnv()

// Tip za uporabo v drugih datotekah
export type Env = z.infer<typeof envSchema>

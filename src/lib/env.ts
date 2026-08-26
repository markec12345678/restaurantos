// ============================================
// VALIDACIJA OKOLJSKIH SPREMENLJIVK Z ZOD
// Fail-fast ob zagonu — prepreči runtime napake zaradi manjkajočih/napačnih env spremenljivk
// Uporaba: import { env } from '@/lib/env'
// ============================================

import { z } from 'zod'

const envSchema = z.object({
  // ── Obvezne spremenljivke ──────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL je obvezna — pot do SQLite baze'),

  // ── Javne spremenljivke (dostopne v brskalniku) ──
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL mora biti veljaven URL').default('http://localhost:3000'),

  // ── Izbirne spremenljivke ──────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // ── AI ─────────────────────────────────────
  GEMINI_API_KEY: z.string().optional(),

  // ── FURS ───────────────────────────────────
  // FIX SECURITY: prejšnji default je bil 'true' — production deploy, ki bi
  // skopiral .env.example, bi tiho poganjal FURS v simulacijskem načinu.
  // Default je sedaj 'false' — eksplicitno moraš nastaviti 'true' za dev/test.
  FURS_ALLOW_SIMULATION: z
    .enum(['true', 'false'])
    .default('false')
    .transform(v => v === 'true'),
  FURS_CERT_PATH: z.string().optional(),
  FURS_KEY_PATH: z.string().optional(),
  FURS_API_URL: z.string().url().optional(),
  FURS_TEST_API_URL: z.string().url().optional(),

  // ── WebSocket ──────────────────────────────
  WS_PORT: z.coerce.number().int().min(1).max(65535).optional(),

  // ── Tiskalniki ─────────────────────────────
  PRINTER_KITCHEN: z.string().optional(),
  PRINTER_BAR: z.string().optional(),
  PRINTER_RECEIPT: z.string().optional(),
  PRINTER_PORT: z.coerce.number().int().min(1).max(65535).optional(),

  // ── SMS / Email ────────────────────────────
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // ── Plačilni modul ────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ── Dostava ────────────────────────────────
  GLOVO_WEBHOOK_SECRET: z.string().optional(),
  WOLT_WEBHOOK_SECRET: z.string().optional(),
  BOLT_WEBHOOK_SECRET: z.string().optional(),

  // ── Multi-location ─────────────────────────
  DEFAULT_LOCATION_ID: z.string().optional(),

  // ── Varnost ────────────────────────────────
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).optional(),
  SESSION_ABSOLUTE_TIMEOUT_HOURS: z.coerce.number().int().min(1).max(720).optional(),

  // ── Varnostne kopije ──────────────────────
  BACKUP_INTERVAL_HOURS: z.coerce.number().int().min(0).optional(),
  BACKUP_PATH: z.string().optional(),
})

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
    // V developmentu vrže podrobno napako, v produkciji le kritične
    const criticalFields = ['DATABASE_URL']
    const hasCriticalErrors = result.error.issues.some(
      issue => criticalFields.includes(issue.path.join('.'))
    )

    if (hasCriticalErrors || process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(
        '\n❌ VALIDACIJA OKOLJSKIH SPREMENLJIVK JE SPODLETELA:\n' +
        errors.join('\n') +
        '\n\nProsimo, preverite .env datoteko glede na .env.example\n'
      )
    }

    // V produkciji in testiranju ne zaustavimo strežnika za neobvezne spremenljivke
    if (hasCriticalErrors) {
      process.exit(1)
    }
  }

  return result.success ? result.data : envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL || 'file:./db/custom.db',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NODE_ENV: process.env.NODE_ENV || 'development',
  })
}

// Singleton — izračuna se enkrat ob prvem uvozu
export const env = parseEnv()

// Tip za uporabo v drugih datotekah
export type Env = z.infer<typeof envSchema>

// ============================================
// RETENTION POLICY — ENOTEN VIR RESNICE (R148-b, epic #115 #35)
// ============================================
// Epic P2-07 "Retention / archival / historical integrity" zahteva DEFINIRATI,
// koliko časa se hranijo posamezni podatki. Ta modul je edini vir hrambenih
// okon — cron (/api/cron/data-retention), preview (/api/audit/retention) in
// arhiv (/api/audit/archive) berejo od tod; NIČ hardcode-anih window-ov.
//
// čista konstanta — BREZ db importa (importabilna tudi s klienta/UI).
//
// Veriga AuditLog je GLOBALNA (schema.prisma: previousHash/chainHash, brez
// location FK) — arhiv/purge je zato VEDNO časovna rezina (timestamp < cutoff)
// in NIKOLI lokacijska. locationId parametra namerno NI.
// ============================================

// ── Tipi ───────────────────────────────────────────────────────────────────

export interface RetentionPolicyEntry {
  /** Prisma model name (kakor v prisma/schema.prisma). */
  entity: 'AuditLog' | 'WebhookDelivery' | 'ScheduledEmailLog' | 'Session'
  /** Hramba v dnevih; null = poseben režim (Session: izbris šele ob poteku). */
  days: number | null
  /** Datumsko polje za cutoff filter (schema.prisma ime); null pri posebnem režimu. */
  dateField: 'timestamp' | 'createdAt' | null
  /** Človeku berljiva utemeljitev (SLO). */
  basis: string
}

export interface DocumentedIndefiniteEntry {
  /** Človeku berljiva oznaka skupine (SLO). */
  entity: string
  /** Prisma modeli v skupini. */
  models: string[]
  /** Zakaj se NE briše (FURS / dokazne zahteve — epic P2-05). */
  reason: string
}

// ── Aktivna retencija (izvrševanje: cron + arhiv) ─────────────────────────

export const AUDIT_LOG_RETENTION_DAYS = 730
export const WEBHOOK_DELIVERY_RETENTION_DAYS = 30
export const SCHEDULED_EMAIL_LOG_RETENTION_DAYS = 90

/**
 * Modeli z AKTIVNO izvrševano retencijo (deleteMany po cutoffu).
 * Pariteta z obstoječim cronom (AuditLog 2y ≈ 730 dni, Webhook 30d,
 * ScheduledEmailLog 90d, Session po poteku) — zdaj iz enega vira.
 */
export const RETENTION_POLICY: readonly RetentionPolicyEntry[] = [
  {
    entity: 'AuditLog',
    days: AUDIT_LOG_RETENTION_DAYS,
    dateField: 'timestamp',
    basis:
      'Revidirni dnevniki 2 leti (730 dni) — GDPR čl. 5(1)(e) omejitev hrambe; ' +
      'podatki so pred izbrisom arhivirani (POST /api/audit/archive?apply=1), ' +
      'veriga ostane preverljiva prek anchor zapisov (AUDIT_RETENTION_PURGED).',
  },
  {
    entity: 'WebhookDelivery',
    days: WEBHOOK_DELIVERY_RETENTION_DAYS,
    dateField: 'createdAt',
    basis:
      'Dostavne sledi webhookov 30 dni — operativna diagnostika integracij ' +
      '(Glovo/Wolt/e-računi), brez poslovne vrednosti po zaprtju meseca.',
  },
  {
    entity: 'ScheduledEmailLog',
    days: SCHEDULED_EMAIL_LOG_RETENTION_DAYS,
    dateField: 'createdAt',
    basis:
      'Dnevnik razporejenih e-poštnih sporočil 90 dni — sledljivost pošiljanja ' +
      'poročil (Z-report, dnevni povzetek) četrtletno.',
  },
  {
    entity: 'Session',
    days: null,
    dateField: null,
    basis:
      'Seje se brišejo SAMO po poteku (expiresAt/absoluteExpiry < now) — ' +
      'varnostna higiena, ne časovno okno; briše cron /api/cron/data-retention.',
  },
] as const

// ── Dokumentirana NEOMEJENA hramba (epic 'DEFINIRAJ' del) ─────────────────

/**
 * Poslovni podatki, ki se NE brišejo — hramba neomejena. Epic #115 P2-07
 * za te entitete zahteva samo DEFINICIJO (ne izvršitve): FURS in
 * računovodska zakonodaja zahtevata hrambo dokazov, brisanje bi porušilo
 * referenčno verigo order → payment → receipt → stock → audit (P2-05).
 */
export const DOCUMENTED_INDEFINITE: readonly DocumentedIndefiniteEntry[] = [
  {
    entity: 'Naročila (orders)',
    models: ['Order'],
    reason:
      'Poslovni dokaz o prometu — FURS/davčna evidence; referenčna veriga ' +
      'order → payment → receipt → stock → audit (epic P2-05) se ne sme pretrgati.',
  },
  {
    entity: 'Računi (receipts)',
    models: ['Receipt'],
    reason:
      'FURS račun je davčni dokument — zakonska hramba 6+ let (ZDDV-1, ' +
      'računovodska zakonodaja); izvrševanja retencije NI.',
  },
  {
    entity: 'Plačila (payments)',
    models: ['Payment'],
    reason:
      'Računovodski dokaz o hotenju — hramba 6+ let skupaj z računi; brisanje ' +
      'bi pretrgalo order → payment referenco.',
  },
  {
    entity: 'Premene zaloge (stock movements)',
    models: ['StockTransaction'],
    reason:
      'Sledljivost zalog (HACCP + inventarna evidencia) — celotna kronologija ' +
      'premen ostane; brisanje bi pretrgalo referenčno verigo do audit zapisa.',
  },
  {
    entity: 'Podatki gostov (customer data)',
    models: ['Guest'],
    reason:
      'CRM zgodovina gostov se hrani dokler obstaja poslovni interes; ' +
      'posamezen gost se briše/anonimizira na zahtevo (GDPR Art. 17 potek ' +
      'prek obstoječih endpointov, ne globalni cron).',
  },
] as const

// ── Človeku berljive opombe (human-readable izvoz) ────────────────────────

export const RETENTION_POLICY_NOTES: readonly string[] = [
  'Vir resnice: src/lib/retention/policy.ts (R148, epic #115 #35 P2-07) — cron, preview in arhiv berejo od tod.',
  'Aktivna retencija: AuditLog 730 dni (timestamp), WebhookDelivery 30 dni (createdAt), ScheduledEmailLog 90 dni (createdAt); Session samo po poteku.',
  'Naročila, računi, plačila, premeni zaloge in podatki gostov se NE brišejo — FURS/računovodska hramba 6+ let in dokazna veriga P2-05.',
  'AuditLog purge je vedno časovna rezina (veriga je globalna, brez locationId) in poteka SAMO po arhiviranju (POST /api/audit/archive?apply=1) ali prek cron joba.',
  'Po purge-u verify-chain prepozna dokumentirano odstranitev prek zapisa AUDIT_RETENTION_PURGED (anchorIn/anchorOut) — veriga ostane "intact".',
] as const

// ── Pomožniki ──────────────────────────────────────────────────────────────

/**
 * Cutoff datum za entiteto z dnevnim oknom (now - days). Vrne null za
 * entitete brez dnevnega okna (Session — poseben režim 'expired') ali za
 * neznano entiteto.
 */
export function retentionCutoffFor(entity: string, now: Date = new Date()): Date | null {
  const entry = RETENTION_POLICY.find(p => p.entity === entity)
  if (!entry || entry.days === null) return null
  return new Date(now.getTime() - entry.days * 24 * 60 * 60 * 1000)
}

/** Vnos politike za entiteto (ali undefined). */
export function retentionEntryFor(entity: string): RetentionPolicyEntry | undefined {
  return RETENTION_POLICY.find(p => p.entity === entity)
}

/**
 * Izvozljiv JSON manifest hrambe (epic 'DEFINIRAJ' deliverable) — čisto
 * JSON-serializabilna oblika za API + UI + arhivske zapise.
 */
export function retentionPolicyJson(now: Date = new Date()): {
  format: string
  version: number
  generatedAt: string
  policy: RetentionPolicyEntry[]
  documentedIndefinite: DocumentedIndefiniteEntry[]
  notes: string[]
} {
  return {
    format: 'restaurantos-retention-policy',
    version: 1,
    generatedAt: now.toISOString(),
    policy: RETENTION_POLICY.map(p => ({ ...p })),
    documentedIndefinite: DOCUMENTED_INDEFINITE.map(d => ({ ...d, models: [...d.models] })),
    notes: [...RETENTION_POLICY_NOTES],
  }
}

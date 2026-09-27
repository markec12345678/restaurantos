'use client'
// ============================================
// R147-c (epic #115 #34) — Prenos podatkov (Data portability)
// POS-shell modul 'data-portability' (navItems 'Sistem' → adminOnly;
// GET /api/export/portability?mode=manifest|full — kontrakt R147-b).
//
// Struktura (vsebina hardcoded sl — kanon modulov; samo nav label je i18n):
//   1. Header 'Prenos podatkov' + ikona,
//   2. 'Kaj je vključeno' — 5 sekcij (meta + tipi iz PORTABILITY_SECTIONS
//      kontrakta; števila tabel/records prihajajo iz MANIFEST odgovora, v UI
//      ni hardcodeanih številk), 2 ključni cross-ref opombi statično +
//      polne opombe arhiva (manifest.notes = PORTABILITY_NOTES s strežnika),
//   3. izključitvena opomba (skrivnosti/PII — statično, vedno vidna),
//   4. MODEL A lokacijski select (samo skrbniki — pariteta R146-c;
//      sentinel 'all' = 'Vse lokacije (globalno)', neaktivne disabled),
//   5. manifest KPI (5 sekcij + skupaj) iz GET ?mode=manifest,
//   6. countsChecksum (64 hex, monospace) + Kopiraj,
//   7. download: manifest (outline) + celoten arhiv (primarni) — authFetch →
//      blob → a[download] iz Content-Disposition (fallback 'prenos-podatkov.json');
//      napaka → toast.error s TOČNO body.error (kanon R143/R146).
//
// OPOMBA glede konstant: strežniški helper
// src/app/api/export/portability/_helpers/portability-sections.ts vleče
// '@/lib/db' (server-only) → client bundle GA NE SME uvažati. UI zato
// konzumira: (a) TIPE PortabilitySection prek `import type` (erased — tsc
// ujete neskladja ob spremembi sekcij), (b) VREDNOSTI (counts/notes) iz
// manifest odgovora v živo; vrstni red sekcij pina r147 test proti
// PORTABILITY_SECTIONS (parity fs-pin).
// Paleta: zinc/emerald/amber/red/green/purple — brez blue/indigo (hišno pravilo).
// ============================================

import { memo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, AlertDescription, AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BookOpen, Copy, DatabaseBackup, Download, FileDown, FileJson,
  Package, ShieldAlert, Users, UtensilsCrossed,
} from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { useAuthUser } from '@/components/pos/sidebar/useAuthUser'
import { portabilityKeys } from '@/lib/query-keys/portability'
import type { PortabilitySection } from '@/app/api/export/portability/_helpers/portability-sections'

// ─── MODEL A (vzorec R146-c ExportReport / R144 NewCardDialog) ──────────────

/** Sentinel za 'Vse lokacije (globalno)' — Radix SelectItem ne sprejme praznega value. */
export const ALL_LOCATIONS_VALUE = 'all'

/** Fallback sporočilo, če strežnik ne vrne body.error. */
export const PORTABILITY_ERROR_MESSAGE = 'Napaka pri pripravi prenosa podatkov'

interface FormLocationOption {
  id: string
  name: string
  isActive: boolean
}

function useFormLocations(enabled: boolean) {
  return useQuery({
    queryKey: ['portability', 'form-locations'] as const,
    queryFn: async (): Promise<FormLocationOption[]> => {
      const res = await authFetch('/api/locations')
      if (!res.ok) return []
      const json = await res.json() as unknown
      const rows: Array<Record<string, unknown>> = Array.isArray(json)
        ? json as Array<Record<string, unknown>>
        : ((json as { locations?: Array<Record<string, unknown>> })?.locations ?? [])
      return rows
        .map((r) => ({ id: String(r.id ?? ''), name: String(r.name ?? ''), isActive: r.isActive !== false }))
        .filter((r) => r.id && r.name)
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}

/** URL portability zahteve — locationId SAMO ko je izbran (brez = globalno, MODEL A). */
export function buildPortabilityUrl(mode: 'manifest' | 'full', locationId?: string | null): string {
  const locationParam = locationId ? `&locationId=${encodeURIComponent(locationId)}` : ''
  return `/api/export/portability?mode=${mode}${locationParam}`
}

/** Ime datoteke iz Content-Disposition; fallback 'prenos-podatkov.json'. */
export function filenameFromDisposition(header: string | null): string {
  const match = header?.match(/filename="([^"]+)"/)
  return match?.[1] ?? 'prenos-podatkov.json'
}

// ─── Manifest odgovor (zrcalo R147-b route.ts — counts-only shape) ──────────

export interface PortabilityManifest {
  format: string
  version: number
  generatedAt: string
  schemaStamp: string
  scope: { locationId: string | null; locationName: string | null }
  counts: Record<string, Record<string, number>>
  countsChecksum: string
  checksum: string
  notes: string[]
}

// ─── UI metadata sekcij (client-safe; parity pina r147 test) ────────────────

/**
 * Vrstni red sekcij v UI — MORA biti identičen PORTABILITY_SECTIONS s
 * strežnika (r147-portability test pina parity; tip spodaj to tudi tsc-u).
 */
export const PORTABILITY_UI_SECTIONS = ['customers', 'menu', 'recipes', 'inventory', 'audit'] as const

interface SectionMetaEntry {
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  tile: string
  valueClass: string
  delay: string
}

/**
 * `Record<PortabilitySection, …>` (import type — erased, ne vleče db v
 * client bundle): če strežnik doda/odstrani sekcijo, tsc odpove TOČNO tukaj.
 */
const SECTION_META: Record<PortabilitySection, SectionMetaEntry> = {
  customers: {
    label: 'Stranke & zvestoba',
    hint: 'Gostje, obiski, zvestoba, rezervacije, čakanje, povratne informacije',
    icon: Users,
    accent: 'bg-emerald-500',
    tile: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    valueClass: 'text-emerald-700 dark:text-emerald-400',
    delay: '0ms',
  },
  menu: {
    label: 'Meni & cene',
    hint: 'Meniji, kategorije, artikli, doplačila in davčne stopnje',
    icon: UtensilsCrossed,
    accent: 'bg-amber-500',
    tile: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    valueClass: 'text-amber-700 dark:text-amber-400',
    delay: '40ms',
  },
  recipes: {
    label: 'Recepture',
    hint: 'Sestavine receptur po artiklih',
    icon: BookOpen,
    accent: 'bg-purple-500',
    tile: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    valueClass: 'text-purple-700 dark:text-purple-400',
    delay: '80ms',
  },
  inventory: {
    label: 'Zaloga & premiki',
    hint: 'Zalogovne postavke in knjiga premikov',
    icon: Package,
    accent: 'bg-green-500',
    tile: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    valueClass: 'text-green-700 dark:text-green-400',
    delay: '120ms',
  },
  audit: {
    label: 'Revizijska sled',
    hint: 'Kurirana revija (brez IP-naslovov in terminalov)',
    icon: ShieldAlert,
    accent: 'bg-red-500',
    tile: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    valueClass: 'text-red-700 dark:text-red-400',
    delay: '160ms',
  },
}

/** Slovensko sklanjanje: 1 tabela / 2 tabeli / 3–4 tabele / 5+ tabel. */
function tabelWord(n: number): string {
  const m = n % 100
  if (m === 1) return 'tabela'
  if (m === 2) return 'tabeli'
  if (m >= 3 && m <= 4) return 'tabele'
  return 'tabel'
}

/** Slovensko sklanjanje: 1 zapis / 2 zapisa / 3–4 zapisi / 5+ zapisov. */
function zapisWord(n: number): string {
  const m = n % 100
  if (m === 1) return 'zapis'
  if (m === 2) return 'zapisa'
  if (m >= 3 && m <= 4) return 'zapisi'
  return 'zapisov'
}

// ─── KPI ploščica (GiftCardLiabilitySection vzorec) ─────────────────────────

interface KpiTileProps {
  label: string
  value: string
  subtitle?: string
  title?: string
  icon: React.ElementType
  accent: string
  tile: string
  valueClass: string
  delay: string
}

function KpiTile({ label, value, subtitle, title, icon: Icon, accent, tile, valueClass, delay }: KpiTileProps) {
  return (
    <div
      className="relative min-w-0 overflow-hidden rounded-lg border p-3 transition-all duration-300 animate-fade-in-up hover:shadow-md"
      style={{ animationDelay: delay }}
      title={title}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} aria-hidden="true" />
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className={`text-xl font-bold tabular-nums leading-none ${valueClass}`}>{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={label}>{label}</p>
          {subtitle && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground tabular-nums" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Glavni modul ───────────────────────────────────────────────────────────

export const DataPortabilityModule = memo(function DataPortabilityModule() {
  // MODEL A: select vidijo samo skrbniki (pariteta R146-c / NewCardDialog).
  const authUser = useAuthUser()
  const isTenantAdmin = authUser?.role === 'admin' || authUser?.role === 'super_admin'
  const { data: locations } = useFormLocations(isTenantAdmin)
  const showLocationSelect = isTenantAdmin && (locations?.length ?? 0) > 0
  const [locationFilter, setLocationFilter] = useState<string>(ALL_LOCATIONS_VALUE)
  const selectedLocationId = locationFilter === ALL_LOCATIONS_VALUE ? null : locationFilter

  // Manifest (counts-only) — en klic na izbiro lokacije (queryKey unifikacija:
  // EN koren ['portability'] prek portabilityKeys). staleTime je ZAVOJENO 0:
  // števci morajo biti sveži ob vsaki zamenjavi lokacije (countsChecksum je
  // preverljivostni dokaz — star katalog bi bil zavajajoč); odgovor je cheap
  // count() read, zato je refetch poceni.
  const manifestQuery = useQuery({
    queryKey: portabilityKeys.manifest(locationFilter),
    queryFn: async (): Promise<PortabilityManifest> => {
      const res = await authFetch(buildPortabilityUrl('manifest', selectedLocationId))
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errBody?.error || PORTABILITY_ERROR_MESSAGE)
      }
      return await res.json() as Promise<PortabilityManifest>
    },
    retry: 1,
  })
  const manifest = manifestQuery.data ?? null

  const [downloading, setDownloading] = useState<'manifest' | 'full' | null>(null)

  // Izvožene sekcije: števila PRIHAJAJO iz manifest odgovora (ni hardcodea).
  const sectionStats = PORTABILITY_UI_SECTIONS.map((section) => {
    const perTable = manifest?.counts?.[section] ?? {}
    const values = Object.values(perTable)
    return { section, tables: values.length, count: values.reduce((sum, n) => sum + n, 0) }
  })
  const totalRecords = sectionStats.reduce((sum, s) => sum + s.count, 0)
  const totalTables = sectionStats.reduce((sum, s) => sum + s.tables, 0)
  const isEmpty = manifest !== null && totalRecords === 0

  const handleCopy = async () => {
    const text = manifest?.countsChecksum
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Natočnica kopirana')
    } catch {
      toast.error('Kopiranje ni uspelo')
    }
  }

  const handleDownload = async (mode: 'manifest' | 'full') => {
    setDownloading(mode)
    try {
      const res = await authFetch(buildPortabilityUrl(mode, selectedLocationId))
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errBody?.error || PORTABILITY_ERROR_MESSAGE)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filenameFromDisposition(res.headers?.get('Content-Disposition') ?? null)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Prenos pripravljen')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : PORTABILITY_ERROR_MESSAGE)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 1. Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
          <DatabaseBackup className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold leading-tight">
            Prenos podatkov
          </h2>
          <p className="text-sm text-muted-foreground">
            Izvoz svojih podatkov v preverljivem JSON formatu (tenant-scoped)
          </p>
        </div>
      </div>

      {/* 2. Kaj je vključeno + opombe */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FileJson className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Kaj je vključeno
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PORTABILITY_UI_SECTIONS.map((section) => {
              const meta = SECTION_META[section]
              const Icon = meta.icon
              return (
                <div key={section} className="min-w-0 rounded-md border p-2.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <p className="truncate text-sm font-medium">{meta.label}</p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{meta.hint}</p>
                </div>
              )
            })}
          </div>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>
              Naročila, plačila, nabava in poročila se izvažajo prek{' '}
              <span className="font-medium text-foreground">Poročila → Izvoz</span> (CSV, epic #33).
            </li>
            <li>
              Zaposleni PII: GDPR izvoz na <code className="bg-muted rounded px-1 py-0.5">/api/gdpr/export/[id]</code>,
              brisanje (Art. 17) na <code className="bg-muted rounded px-1 py-0.5">/api/gdpr/anonymize/[id]</code>.
            </li>
          </ul>
          <p className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Ni vključeno: gesla in PIN-i, seje, API ključi, biometrija, skrivne nastavitve, IP naslovi v revizijski sledi.
          </p>
          {manifest !== null && manifest.notes.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                Opombe arhiva ({manifest.notes.length})
              </summary>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                {manifest.notes.map((note, i) => (
                  <li key={`note-${i}`}>{note}</li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      {/* 4. MODEL A lokacijski select (samo skrbniki) */}
      {showLocationSelect && (
        <div className="space-y-2">
          <Label htmlFor="portability-location" className="text-sm font-semibold">Lokacija</Label>
          <Select value={locationFilter} onValueChange={v => setLocationFilter(v)}>
            <SelectTrigger id="portability-location" className="w-full sm:max-w-xs">
              <SelectValue placeholder="Vse lokacije (globalno)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LOCATIONS_VALUE}>Vse lokacije (globalno)</SelectItem>
              {locations!.map(l => (
                <SelectItem key={l.id} value={l.id} disabled={!l.isActive}>
                  {l.name}{!l.isActive ? ' (neaktivna)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Izberite lokacijo za izvoz po posamezni poslovalnici. Pustite izbrano »Vse lokacije« za globalni izvoz (vključno z vrsticami brez lokacije).
          </p>
        </div>
      )}

      {/* 5–6. Manifest: KPI sekcije + countsChecksum */}
      {manifestQuery.isLoading ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Manifest prenosa se nalaga"
        >
          {[...Array(6)].map((_, i) => (<Skeleton key={`skeleton-${i}`} className="h-20" />))}
        </div>
      ) : manifestQuery.isError ? (
        <Card>
          <CardContent className="p-4">
            <Alert variant="destructive">
              <AlertTitle>Napaka pri nalaganju manifesta</AlertTitle>
              <AlertDescription>
                {manifestQuery.error instanceof Error ? manifestQuery.error.message : PORTABILITY_ERROR_MESSAGE}
                {' '}Podatki ostanejo nespremenjeni — poskusite znova.
              </AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" onClick={() => manifestQuery.refetch()} className="mt-3 gap-2">
              <Download className="h-4 w-4" aria-hidden="true" /> Poskusi znova
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {isEmpty ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Ni podatkov za izvoz</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sectionStats.map(({ section, tables, count }) => {
                const meta = SECTION_META[section]
                return (
                  <KpiTile
                    key={section}
                    label={meta.label}
                    value={String(count)}
                    subtitle={`${tables} ${tabelWord(tables)}`}
                    title={`${meta.label}: ${count} ${zapisWord(count)} v ${tables} ${tabelWord(tables)}`}
                    icon={meta.icon}
                    accent={meta.accent}
                    tile={meta.tile}
                    valueClass={meta.valueClass}
                    delay={meta.delay}
                  />
                )
              })}
              <KpiTile
                label="zapisov skupaj"
                value={String(totalRecords)}
                subtitle={`${totalTables} ${tabelWord(totalTables)}`}
                title="Skupno število zapisov v vseh sekcijah manifesta"
                icon={DatabaseBackup}
                accent="bg-zinc-500"
                tile="bg-zinc-100 dark:bg-zinc-900/30 text-zinc-700 dark:text-zinc-300"
                valueClass=""
                delay="200ms"
              />
            </div>
          )}

          {manifest?.countsChecksum && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Natočnica števcev (countsChecksum — preverljivost izvoza)
                </p>
                <p
                  className="truncate font-mono text-xs tabular-nums"
                  title={manifest.countsChecksum}
                  data-testid="portability-counts-checksum"
                >
                  {manifest.countsChecksum}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Kopiraj
              </Button>
            </div>
          )}

          {/* 7. Download gumbi */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Izvoz arhiva</p>
                <p className="text-xs text-muted-foreground">
                  Manifest vsebuje samo števce; celoten arhiv doda vrstice vseh tabel (JSON preverljiv po checksumu).
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => handleDownload('manifest')}
                  disabled={downloading !== null}
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Prenesi manifest (JSON)
                </Button>
                <Button
                  onClick={() => handleDownload('full')}
                  disabled={downloading !== null}
                >
                  <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
                  {downloading === 'full' ? 'Pripravljam …' : 'Prenesi celotne podatke (JSON)'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
})

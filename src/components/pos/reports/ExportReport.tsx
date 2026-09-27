'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, ShoppingBag, Package, Receipt, Users, Clock, FileText, FileSpreadsheet, FileCode, FileDown, CreditCard, Undo2, Truck, CalendarCheck, BookOpen } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { useAuthUser } from '@/components/pos/sidebar/useAuthUser'

// ============================================
// IZVOZ POROČIL — CSV / PDF / Excel / eDavki XML
// ============================================

type ExportFormat = 'csv' | 'pdf' | 'excel' | 'xml'

interface ExportTypeConfig {
  value: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  // Kateri formati so na voljo za to vrsto poročila
  formats: ExportFormat[]
}

interface FormatConfig {
  value: ExportFormat
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  extension: string
  mimeType: string
}

const FORMAT_CONFIGS: FormatConfig[] = [
  {
    value: 'csv',
    label: 'CSV',
    description: 'Excel/Google Sheets — podpičje, UTF-8 z BOM',
    icon: FileText,
    extension: 'csv',
    mimeType: 'text/csv',
  },
  {
    value: 'pdf',
    label: 'PDF',
    description: 'Tiskanje / arhiviranje — profesionalni format',
    icon: FileDown,
    extension: 'pdf',
    mimeType: 'application/pdf',
  },
  {
    value: 'excel',
    label: 'Excel (XLSX)',
    description: 'Native Excel z več listi in formatiranjem',
    icon: FileSpreadsheet,
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    value: 'xml',
    label: 'eDavki XML',
    description: 'Slovenski standard za FURS predajo DDV',
    icon: FileCode,
    extension: 'xml',
    mimeType: 'application/xml',
  },
]

export const EXPORT_TYPES: ExportTypeConfig[] = [
  { value: 'orders', label: 'Naročila', description: 'Vsa naročila s podrobnostmi in artikli', icon: ShoppingBag, formats: ['csv', 'pdf', 'excel'] },
  { value: 'items', label: 'Artikli', description: 'Prodaja po artiklih s kategorijami in DDV', icon: Package, formats: ['csv', 'pdf', 'excel'] },
  { value: 'vat', label: 'DDV', description: 'DDV razčlenitev po stopnjah za FURS', icon: Receipt, formats: ['csv', 'pdf', 'excel', 'xml'] },
  { value: 'employees', label: 'Zaposleni', description: 'Prodaja in napitnine po zaposlenih', icon: Users, formats: ['csv', 'pdf', 'excel'] },
  { value: 'shifts', label: 'Izmene', description: 'Podatki o izmenah blagajne', icon: Clock, formats: ['csv', 'pdf', 'excel'] },
  { value: 'inventory', label: 'Zaloga', description: 'Trenutno stanje zaloge', icon: Package, formats: ['csv', 'pdf', 'excel'] },
  // R146 #33 Accounting exports — računovodski izvozi (samo CSV, reproducibilni)
  { value: 'payments', label: 'Plačila', description: 'Vsa plačila po metodah s statusi in napitninami', icon: CreditCard, formats: ['csv'] },
  { value: 'refunds', label: 'Povračila', description: 'Povračila plačil po obdobju', icon: Undo2, formats: ['csv'] },
  { value: 'purchases', label: 'Nabava', description: 'Naročila dobaviteljem s statusi računov in DDV', icon: Truck, formats: ['csv'] },
  { value: 'expenses', label: 'Stroški', description: 'Knjiženi stroški iz revizijske sledi', icon: Receipt, formats: ['csv'] },
  { value: 'daily-close', label: 'Dnevni zaključek', description: 'Dnevni zaključki poslovalnic (Z-poročila)', icon: CalendarCheck, formats: ['csv'] },
  { value: 'journal', label: 'Dnevnik', description: 'Knjigovodski dnevnik (dvojno knjiženje)', icon: BookOpen, formats: ['csv'] },
]

// --- R146 #33 (MODEL A): lokacije za izvoz po posamezni poslovalnici (samo skrbniki) ---

/** Sentinel za 'Vse lokacije (globalno)' — Radix SelectItem ne sprejme praznega value. */
export const ALL_LOCATIONS_VALUE = 'all'

interface FormLocationOption {
  id: string
  name: string
  isActive: boolean
}

function useFormLocations(enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'form-locations'] as const,
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

/** R146 #33: URL izvoza — locationId je dodan SAMO ko je izbran (prazen = globalno, MODEL A). */
export function buildExportUrl(exportType: string, exportFormat: string, startDate: string, endDate: string, locationId?: string | null): string {
  const locationParam = locationId ? `&locationId=${encodeURIComponent(locationId)}` : ''
  return `/api/reports/export?type=${exportType}&format=${exportFormat}&startDate=${startDate}&endDate=${endDate}${locationParam}`
}

export function ExportReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exportType, setExportType] = useState('orders')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [exporting, setExporting] = useState(false)
  // R146 #33 (MODEL A): skrbniška seja lahko izvozi po posamezni poslovalnici
  // (?locationId=) ali globalno (prazno = vse lokacije). Regular uporabnik s
  // session lokacijo selecta NE vidi — server rezolvira obseg iz seje.
  const authUser = useAuthUser()
  const isTenantAdmin = authUser?.role === 'admin' || authUser?.role === 'super_admin'
  const { data: locations } = useFormLocations(isTenantAdmin)
  const showLocationSelect = isTenantAdmin && (locations?.length ?? 0) > 0
  const [locationFilter, setLocationFilter] = useState<string>(ALL_LOCATIONS_VALUE)
  const selectedLocationId = locationFilter === ALL_LOCATIONS_VALUE ? '' : locationFilter

  const currentType = EXPORT_TYPES.find(t => t.value === exportType) || EXPORT_TYPES[0]
  const availableFormats = currentType.formats
  const currentFormat = FORMAT_CONFIGS.find(f => f.value === exportFormat) || FORMAT_CONFIGS[0]

  // Če trenutni format ni na voljo za izbrani tip, preklopi na prvega razpoložljivega
  if (!availableFormats.includes(exportFormat)) {
    setExportFormat(availableFormats[0])
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await authFetch(
        buildExportUrl(exportType, exportFormat, startDate, endDate, selectedLocationId)
      )
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Napaka pri izvozu' }))
        throw new Error(errBody.error || 'Napaka pri izvozu')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${exportType}_${startDate}_${endDate}.${currentFormat.extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Poročilo izvoženo v ${currentFormat.label} formatu`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Napaka pri izvozu poročila')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Download className="h-5 w-5" />
          Izvoz poročil
        </h3>
        <div className="flex items-center gap-3">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" aria-label="Datum začetka" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" aria-label="Datum konca" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Izberite vrsto poročila in format izvoza. Na voljo so CSV (Excel), PDF (tiskanje), Excel (XLSX) in eDavki XML (FURS predaja).
      </p>

      {/* R146 #33 (MODEL A): izbira lokacije za izvoz (samo skrbniki) */}
      {showLocationSelect && (
        <div className="space-y-2">
          <Label htmlFor="export-location" className="text-sm font-semibold">Lokacija</Label>
          <Select value={locationFilter} onValueChange={v => setLocationFilter(v)}>
            <SelectTrigger id="export-location" className="w-full sm:max-w-xs">
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
            Izberite lokacijo za izvoz po posamezni poslovalnici. Pustite prazno za vse lokacije (globalno).
          </p>
        </div>
      )}

      {/* Izbira vrste izvoza */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">1. Vrsta poročila</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EXPORT_TYPES.map(type => {
            const Icon = type.icon
            const isActive = exportType === type.value
            return (
              <button
                key={type.value}
                onClick={() => setExportType(type.value)}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                  isActive ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-accent/50'
                }`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`font-semibold text-sm ${isActive ? 'text-primary' : ''}`}>{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Izbira formata */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">2. Format izvoza</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FORMAT_CONFIGS.map(fmt => {
            const Icon = fmt.icon
            const isActive = exportFormat === fmt.value
            const isAvailable = availableFormats.includes(fmt.value)
            return (
              <button
                key={fmt.value}
                onClick={() => isAvailable && setExportFormat(fmt.value)}
                disabled={!isAvailable}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                  isActive
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : isAvailable
                    ? 'border-border hover:bg-accent/50 cursor-pointer'
                    : 'border-border opacity-40 cursor-not-allowed'
                }`}
              >
                <Icon className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`font-semibold text-sm ${isActive ? 'text-primary' : ''}`}>{fmt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{fmt.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Gumb za izvoz */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-semibold">
                Izvoz: {currentType.label} → {currentFormat.label}
              </p>
              <p className="text-sm text-muted-foreground">
                Obdobje: {new Date(startDate).toLocaleDateString('sl-SI')} — {new Date(endDate).toLocaleDateString('sl-SI')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Datoteka: <code className="bg-muted px-1.5 py-0.5 rounded">{exportType}_{startDate}_{endDate}.{currentFormat.extension}</code>
              </p>
            </div>
            <Button size="lg" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Izvažam...' : `Prenesi ${currentFormat.label}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Opombe */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">Opombe o izvozu:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>CSV:</strong> Podpičje (;) kot ločilo, UTF-8 z BOM za slovenske znake (š, č, ž)</li>
              <li><strong>PDF:</strong> Profesionalen format za tiskanje in arhiviranje — vsebuje glavo s podatki restavracije</li>
              <li><strong>Excel (XLSX):</strong> Native Excel z več listi, formatiranjem in formulami</li>
              <li><strong>eDavki XML:</strong> Slovenski standard za FURS predajo DDV (dostopen samo za DDV poročilo)</li>
              <li>Naročila vsebujejo vse statuse (tudi preklicana) z razlogom</li>
              <li>Zaloga izvozi trenutno stanje ne glede na izbrano obdobje</li>
              <li>Računovodski izvozi (Plačila, Povračila, Nabava, Stroški, Dnevni zaključek, Dnevnik) so na voljo izključno v CSV formatu</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

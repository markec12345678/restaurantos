'use client'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, ShoppingBag, Package, Receipt, Users, Clock } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// IZVOZ POROČIL V CSV
// ============================================
export function ExportReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exportType, setExportType] = useState('orders')
  const [exporting, setExporting] = useState(false)
  const exportTypes = [
    { value: 'orders', label: 'Naročila', description: 'Vsa naročila s podrobnostmi in artikli', icon: ShoppingBag },
    { value: 'items', label: 'Artikli', description: 'Prodaja po artiklih s kategorijami in DDV', icon: Package },
    { value: 'vat', label: 'DDV', description: 'DDV razčlenitev po stopnjah', icon: Receipt },
    { value: 'employees', label: 'Zaposleni', description: 'Prodaja in napitnine po zaposlenih', icon: Users },
    { value: 'shifts', label: 'Izmene', description: 'Podatki o izmenah blagajne', icon: Clock },
    { value: 'inventory', label: 'Zaloga', description: 'Trenutno stanje zaloge', icon: Package },
  ]
  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await authFetch(`/api/reports/export?type=${exportType}&startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error('Napaka pri izvozu')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${exportType}_${startDate}_${endDate}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (_error: unknown) {
      toast.error('Napaka pri izvozu poročila')
    } finally {
      setExporting(false)
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Download className="h-5 w-5" />
          Izvoz poročil v CSV
        </h3>
        <div className="flex items-center gap-3">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" aria-label="Datum začetka" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" aria-label="Datum konca" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Izvozite podatke v CSV format, ki ga odprete v Excelu ali drugem programu. Datoteka uporablja UTF-8 kodiranje s podporo za slovenske znake.
      </p>
      {/* Izbira vrste izvoza */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {exportTypes.map(type => {
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
      {/* Gumb za izvoz */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Izvoz: {exportTypes.find(t => t.value === exportType)?.label}</p>
              <p className="text-sm text-muted-foreground">
                Obdobje: {new Date(startDate).toLocaleDateString('sl-SI')} — {new Date(endDate).toLocaleDateString('sl-SI')}
              </p>
            </div>
            <Button size="lg" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Izvažam...' : 'Prenesi CSV'}
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
              <li>CSV datoteka uporablja podpičje (;) kot ločilo za združljivost s slovenskim Excelom</li>
              <li>Kodiranje je UTF-8 z BOM za pravilen prikaz slovenskih znakov (š, č, ž)</li>
              <li>Naročila vsebujejo vse statuse (tudi preklicana) z razlogom</li>
              <li>DDV izvoz vsebuje razčlenitev po stopnjah (22%, 9.5%, 0%) za FURS poročanje</li>
              <li>Zaloga izvozi trenutno stanje ne glede na izbrano obdobje</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

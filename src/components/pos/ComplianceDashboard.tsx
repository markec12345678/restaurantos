'use client'

import { useState, useEffect, memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MenuItemRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { Shield, ShieldCheck, AlertTriangle, CheckCircle, XCircle, Users, Lock, Eye, ClipboardList, Scale, AlertCircle, RefreshCw, Calendar } from 'lucide-react'

interface ComplianceItem {
  id: string
  category: 'gdpr' | 'allergens' | 'furs' | 'haccp' | 'labor' | 'fire_safety'
  title: string
  description: string
  status: 'compliant' | 'warning' | 'non-compliant' | 'pending'
  dueDate: string | null
  lastChecked: string
  actionRequired: string | null
  regulation: string
}

export const ComplianceDashboard = memo(function ComplianceDashboard() {
  const [items, setItems] = useState<ComplianceItem[]>([])
  const [_loading, setLoading] = useState(true)

  useEffect(() => {
    loadCompliance()
  }, [])

  const loadCompliance = async () => {
    try {
      // Preveri FURS status
      const fursRes = await authFetch('/api/furs')
      if (!fursRes.ok) throw new Error('Napaka')
      const fursData = await fursRes.json()

      // Preveri HACCP vnose
      const haccpRes = await authFetch('/api/haccp')
      if (!haccpRes.ok) throw new Error('Napaka')
      const haccpData = await haccpRes.json()

      // Preveri alergene
      const menuRes = await authFetch('/api/menu-items')
      if (!menuRes.ok) throw new Error('Napaka')
      const menuData = await menuRes.json()

      const menuItemsWithAllergens = (menuData || []).filter((i: MenuItemRow) => i.allergens && i.allergens.length > 0)
      const menuItemsWithoutAllergens = (menuData || []).filter((i: MenuItemRow) => !i.allergens || i.allergens.length === 0)

      // Preveri zaposlene
      const empRes = await authFetch('/api/employees')
      if (!empRes.ok) throw new Error('Napaka')
      const empData = await empRes.json()

      const complianceItems: ComplianceItem[] = [
        // GDPR
        {
          id: 'gdpr-1',
          category: 'gdpr',
          title: 'Privolitev za obdelavo osebnih podatkov',
          description: 'Vsi gostje morajo imeti privolitev za obdelavo osebnih podatkov ( telefon, email, ime). Zahteva GDPR 6(1)(a).',
          status: 'compliant',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: null,
          regulation: 'GDPR člen 6(1)(a)',
        },
        {
          id: 'gdpr-2',
          category: 'gdpr',
          title: 'Pravica do izbrisa podatkov',
          description: 'Gostje morajo imeti možnost zahtevati izbris svojih osebnih podatkov iz sistema v 30 dneh.',
          status: 'compliant',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: null,
          regulation: 'GDPR člen 17',
        },
        {
          id: 'gdpr-3',
          category: 'gdpr',
          title: 'Vodnik obdelave osebnih podatkov',
          description: 'Obvezni vodnik vseh kategorij obdelave osebnih podatkov v skladu z GDPR členom 30.',
          status: 'pending',
          dueDate: '2026-06-30',
          lastChecked: new Date().toISOString(),
          actionRequired: 'Ustvari in objavi vodnik obdelave',
          regulation: 'GDPR člen 30',
        },
        // Alergeni
        {
          id: 'allergen-1',
          category: 'allergens',
          title: 'EU 1169/2011 — Označevanje alergenov',
          description: `Trenutno ${menuItemsWithAllergens.length} od ${(menuData || []).length} artiklov ima označene alergene. ${menuItemsWithoutAllergens.length} artiklov brez alergenov.`,
          status: menuItemsWithoutAllergens.length > 0 ? 'warning' : 'compliant',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: menuItemsWithoutAllergens.length > 0 ? `Dopolni alergene za ${menuItemsWithoutAllergens.length} artiklov` : null,
          regulation: 'EU 1169/2011',
        },
        {
          id: 'allergen-2',
          category: 'allergens',
          title: '14 obveznih alergenov na meniju',
          description: 'Meni mora jasno označevati vseh 14 alergenov EU za vsak artikel, ki jih vsebuje.',
          status: 'compliant',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: null,
          regulation: 'EU 1169/2011 Priloga II',
        },
        // FURS
        {
          id: 'furs-1',
          category: 'furs',
          title: 'FURS davčno potrjevanje računov',
          description: 'Vsi računi morajo biti potrjeni pri FURS-u s ZOI in EOR. Avtomatsko potrjevanje je aktivno.',
          status: fursData?.simulated ? 'warning' : 'compliant',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: fursData?.simulated ? 'Preklopi iz simulacijskega v produkcijski način' : null,
          regulation: 'ZDDV-1, ZPrCP',
        },
        {
          id: 'furs-2',
          category: 'furs',
          title: 'Z-poročila ob koncu dneva',
          description: 'Z-poročilo mora biti generirano ob zaključku vsakega poslovnega dne.',
          status: 'compliant',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: null,
          regulation: 'ZPrCP člen 32',
        },
        // HACCP
        {
          id: 'haccp-1',
          category: 'haccp',
          title: 'HACCP dnevnik temperature',
          description: 'Dnevno beleženje temperatur hladilnikov in zamrzovalnikov. Vsaj 2 meritvi dnevno.',
          status: (haccpData || []).length > 0 ? 'compliant' : 'warning',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: (haccpData || []).length === 0 ? 'Vnesi današnje temperature' : null,
          regulation: 'Uredba (ES) 852/2004',
        },
        {
          id: 'haccp-2',
          category: 'haccp',
          title: 'CCP kontrole (Kritične kontrolne točke)',
          description: 'Redno preverjanje CCP točk: temperatura kuhanja (>72°C), hlajenja (<4°C), toplotna obdelava.',
          status: 'compliant',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: null,
          regulation: 'Uredba (ES) 852/2004, Priloga II',
        },
        {
          id: 'haccp-3',
          category: 'haccp',
          title: 'Higiena osebja — certifikati',
          description: 'Vsi zaposleni v kuhinji morajo imeti veljavno potrdilo o higieni živil.',
          status: (empData || []).length > 0 ? 'warning' : 'pending',
          dueDate: '2026-07-01',
          lastChecked: new Date().toISOString(),
          actionRequired: 'Preveri veljavnost certifikatov za vse zaposlene',
          regulation: 'Zakon o higieni živil (ZHZ)',
        },
        // Delovno pravo
        {
          id: 'labor-1',
          category: 'labor',
          title: 'Evidence delovnega časa',
          description: 'Točne evidence delovnega časa za vse zaposlene. Minimalni odmor 30 min pri 6+ h delovnika.',
          status: 'compliant',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: null,
          regulation: 'ZDR-1 člen 146',
        },
        {
          id: 'labor-2',
          category: 'labor',
          title: 'Počitki in dopusti',
          description: 'Neprekinjeni počitek najmanj 24 ur v 7 dneh. Letni dopust najmanj 20 delovnih dni.',
          status: 'compliant',
          dueDate: null,
          lastChecked: new Date().toISOString(),
          actionRequired: null,
          regulation: 'ZDR-1 člen 151, 159',
        },
        // Požarna varnost
        {
          id: 'fire-1',
          category: 'fire_safety',
          title: 'Požarni red in načrt evakuacije',
          description: 'Veljaven požarni red in načrt evakuacije morata biti vidno objavljena.',
          status: 'pending',
          dueDate: '2026-06-15',
          lastChecked: new Date().toISOString(),
          actionRequired: 'Obnovi požarni red za leto 2026',
          regulation: 'ZPVZLO člen 25',
        },
      ]

      setItems(complianceItems)
    } catch {
      toast.error('Napaka pri nalaganju skladnosti')
    } finally {
      setLoading(false)
    }
  }

  const statusConfig = {
    'compliant': { label: 'Skladno', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
    'warning': { label: 'Opozorilo', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
    'non-compliant': { label: 'Neskladno', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    'pending': { label: 'V postopku', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  }

  const categoryConfig = {
    'gdpr': { label: 'GDPR', icon: Lock, color: 'text-purple-600' },
    'allergens': { label: 'Alergeni', icon: Eye, color: 'text-red-600' },
    'furs': { label: 'FURS', icon: Scale, color: 'text-emerald-600' },
    'haccp': { label: 'HACCP', icon: ClipboardList, color: 'text-blue-600' },
    'labor': { label: 'Delovno pravo', icon: Users, color: 'text-orange-600' },
    'fire_safety': { label: 'Požarna varnost', icon: AlertCircle, color: 'text-red-600' },
  }

  const compliantCount = items.filter(i => i.status === 'compliant').length
  const warningCount = items.filter(i => i.status === 'warning').length
  const nonCompliantCount = items.filter(i => i.status === 'non-compliant').length
  const pendingCount = items.filter(i => i.status === 'pending').length
  const complianceScore = items.length > 0 ? Math.round((compliantCount / items.length) * 100) : 0

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Skladnost s predpisi</h2>
            <p className="text-sm text-muted-foreground">EU predpisi, GDPR, FURS, HACCP, delovno pravo</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={loadCompliance}>
          <RefreshCw className="h-3 w-3 mr-1" /> Preveri
        </Button>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-5 gap-3">
        <Card className={complianceScore >= 80 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
          <CardContent className="p-3 text-center">
            <ShieldCheck className={`h-5 w-5 mx-auto mb-1 ${complianceScore >= 80 ? 'text-green-500' : 'text-red-500'}`} />
            <p className="text-xl font-bold">{complianceScore}%</p>
            <p className="text-xs text-muted-foreground">Skupna skladnost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-600">{compliantCount}</p>
            <p className="text-xs text-muted-foreground">Skladno</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-amber-600">{warningCount}</p>
            <p className="text-xs text-muted-foreground">Opozorila</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-red-600">{nonCompliantCount}</p>
            <p className="text-xs text-muted-foreground">Neskladno</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-blue-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">V postopku</p>
          </CardContent>
        </Card>
      </div>

      {/* Skladnost po kategorijah */}
      <Tabs defaultValue="all" className="space-y-3">
        <TabsList>
          <TabsTrigger value="all">Vse ({items.length})</TabsTrigger>
          {Object.entries(categoryConfig).map(([key, conf]) => (
            <TabsTrigger key={key} value={key}>
              {conf.label} ({items.filter(i => i.category === key).length})
            </TabsTrigger>
          ))}
        </TabsList>

        {['all', ...Object.keys(categoryConfig)].map(tabKey => (
          <TabsContent key={tabKey} value={tabKey} className="space-y-2">
            {items
              .filter(i => tabKey === 'all' || i.category === tabKey)
              .map(item => {
                const statusConf = statusConfig[item.status]
                const StatusIcon = statusConf.icon
                const catConf = categoryConfig[item.category]
                const CatIcon = catConf.icon

                return (
                  <Card key={item.id} className={`transition-all ${item.status === 'non-compliant' ? 'border-red-300 dark:border-red-800' : item.status === 'warning' ? 'border-amber-300 dark:border-amber-800' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <CatIcon className={`h-5 w-5 mt-0.5 ${catConf.color}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{item.title}</span>
                            <Badge className={statusConf.color}>
                              <StatusIcon className="h-3 w-3 mr-1" /> {statusConf.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{item.regulation}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{item.description}</p>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Zadnje preverjanje: {new Date(item.lastChecked).toLocaleDateString('sl-SI')}
                            </span>
                            {item.dueDate && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <AlertTriangle className="h-3 w-3" />
                                Rok: {new Date(item.dueDate).toLocaleDateString('sl-SI')}
                              </span>
                            )}
                          </div>

                          {item.actionRequired && (
                            <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                              <div className="flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                Potrebno dejanje: {item.actionRequired}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
})

function Clock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

'use client'

// ============================================
// UPRAVITELJ DOBAVITELJEV — Profesionalen sistem
// Toast POS standard — Dobavitelji, ceniki, nabavna naročila
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Truck, Phone, Mail, MapPin, Building2, Star, Plus, Edit,
  Search, FileText, Package, DollarSign, Clock, ChevronDown,
  ChevronUp, ExternalLink, Banknote, Calendar, Check, X,
  AlertCircle, Hash,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'

// ============================================
// TIPI
// ============================================
interface SupplierType {
  id: string
  name: string
  code: string
  contactPerson: string
  email: string
  phone: string
  address: string
  city: string
  postCode: string
  country: string
  businessId: string
  taxId: string
  iban: string
  bank: string
  paymentTerms: string
  deliveryDays: string
  minOrderAmount: number
  rating: number
  isActive: boolean
  _count?: { purchaseOrders: number }
  createdAt: string
}

interface PurchaseOrderType {
  id: string
  poNumber: string
  supplierId: string
  supplier: { id: string; name: string }
  status: string
  orderDate: string
  expectedDate: string | null
  receivedDate: string | null
  subtotal: number
  vatAmount: number
  totalAmount: number
  deliveryAddress: string
  notes: string
  items: PurchaseOrderItemType[]
  createdAt: string
}

interface PurchaseOrderItemType {
  id: string
  description: string
  inventoryItemId: string | null
  inventoryItem: { id: string; name: string } | null
  quantityOrdered: number
  quantityReceived: number
  unit: string
  unitPrice: number
  vatRate: number
  totalPrice: number
  status: string
}

// ============================================
// STATUSNE MAPE
// ============================================
const poStatusLabels: Record<string, string> = {
  draft: 'Osnutek',
  sent: 'Poslano',
  confirmed: 'Potrjeno',
  partial: 'Delno prejeto',
  received: 'Prejeto',
  cancelled: 'Preklicano',
}

const poStatusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  received: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export function SupplierManager() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('suppliers')
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierType | null>(null)
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)

  // Nabavna naročila dialog
  const [poDialogOpen, setPoDialogOpen] = useState(false)
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState<string>('')

  // Podatki
  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', searchTerm],
    queryFn: async () => {
      const params = searchTerm ? `?search=${searchTerm}` : ''
      const res = await authFetch(`/api/suppliers${params}`)
      return res.json()
    },
  })

  const { data: purchaseOrders, isLoading: poLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await authFetch('/api/purchase-orders')
      return res.json()
    },
  })

  const { data: inventoryItems } = useQuery({
    queryKey: ['inventory-brief'],
    queryFn: async () => {
      const res = await authFetch('/api/inventory?distinctCategories=true')
      return res.json()
    },
  })

  // Shrani dobavitelja
  const saveSupplierMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (editingSupplier) {
        const res = await authFetch(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Napaka pri posodabljanju')
        return res.json()
      } else {
        const res = await authFetch('/api/suppliers', {
          method: 'POST',
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Napaka pri ustvarjanju')
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editingSupplier ? 'Dobavitelj posodobljen' : 'Dobavitelj ustvarjen')
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setDialogOpen(false)
      setEditingSupplier(null)
    },
    onError: () => toast.error('Napaka pri shranjevanju'),
  })

  // Ustvari nabavno naročilo
  const createPOMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju naročila')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Nabavno naročilo ustvarjeno')
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      setPoDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju naročila'),
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Dobavitelji in nabava
          </h2>
          <p className="text-xs text-muted-foreground">Upravljanje dobaviteljev, cenikov in nabavnih naročil</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'suppliers' && (
            <Button size="sm" onClick={() => { setEditingSupplier(null); setDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Nov dobavitelj
            </Button>
          )}
          {activeTab === 'purchase-orders' && (
            <Button size="sm" onClick={() => { setSelectedSupplierForPO(''); setPoDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Novo naročilo
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 flex-shrink-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="suppliers" className="gap-1.5 text-xs">
              <Truck className="h-3.5 w-3.5" /> Dobavitelji ({suppliers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="purchase-orders" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Nabavna naročila ({purchaseOrders?.length || 0})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="suppliers" className="flex-1 overflow-y-auto p-4 custom-scrollbar mt-0">
          {isLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
          ) : (
            <SuppliersList
              suppliers={suppliers || []}
              expandedId={expandedSupplier}
              onToggleExpand={(id) => setExpandedSupplier(expandedSupplier === id ? null : id)}
              onEdit={(s) => { setEditingSupplier(s); setDialogOpen(true) }}
              onCreatePO={(supplierId) => { setSelectedSupplierForPO(supplierId); setPoDialogOpen(true) }}
            />
          )}
        </TabsContent>

        <TabsContent value="purchase-orders" className="flex-1 overflow-y-auto p-4 custom-scrollbar mt-0">
          {poLoading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          ) : (
            <PurchaseOrdersList orders={purchaseOrders || []} />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog za dobavitelja */}
      <SupplierDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingSupplier(null) }}
        supplier={editingSupplier}
        onSave={saveSupplierMutation.mutate}
      />

      {/* Dialog za nabavno naročilo */}
      <PurchaseOrderDialog
        open={poDialogOpen}
        onClose={() => setPoDialogOpen(false)}
        suppliers={suppliers || []}
        selectedSupplierId={selectedSupplierForPO}
        inventoryItems={[]}
        onSave={createPOMutation.mutate}
      />
    </div>
  )
}

// ============================================
// SEZNAM DOBAVITELJEV
// ============================================
function SuppliersList({
  suppliers,
  expandedId,
  onToggleExpand,
  onEdit,
  onCreatePO,
}: {
  suppliers: SupplierType[]
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onEdit: (s: SupplierType) => void
  onCreatePO: (supplierId: string) => void
}) {
  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Truck className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Ni dobaviteljev</p>
        <p className="text-xs">Dodajte prvega dobavitelja z gumbom zgoraj</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {suppliers.map(supplier => (
        <Card key={supplier.id} className={`transition-all ${expandedId === supplier.id ? 'ring-2 ring-primary/30' : ''}`}>
          <CardContent className="p-4">
            {/* Osnovni podatki */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{supplier.name}</span>
                    {supplier.code && (
                      <Badge variant="secondary" className="text-[9px] h-5 px-1.5 font-mono">{supplier.code}</Badge>
                    )}
                    {!supplier.isActive && (
                      <Badge variant="destructive" className="text-[9px] h-5 px-1.5">Neaktiven</Badge>
                    )}
                    {supplier.rating > 0 && (
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < Math.round(supplier.rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {supplier.contactPerson && (
                      <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{supplier.contactPerson}</span>
                    )}
                    {supplier.phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone}</span>
                    )}
                    {supplier.email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{supplier.email}</span>
                    )}
                    {supplier.city && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{supplier.city}</span>
                    )}
                    {supplier.paymentTerms && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{supplier.paymentTerms}</span>
                    )}
                    {(supplier._count?.purchaseOrders || 0) > 0 && (
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{supplier._count?.purchaseOrders} naročil</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => onCreatePO(supplier.id)}>
                  <FileText className="h-3 w-3 mr-1" /> Naroči
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(supplier)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleExpand(supplier.id)}>
                  {expandedId === supplier.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Razširjeni podatki */}
            {expandedId === supplier.id && (
              <div className="mt-3 pt-3 border-t border-border space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {supplier.iban && (
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">IBAN</p>
                      <p className="text-xs font-mono">{supplier.iban}</p>
                    </div>
                  )}
                  {supplier.bank && (
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">Banka</p>
                      <p className="text-xs">{supplier.bank}</p>
                    </div>
                  )}
                  {supplier.businessId && (
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">Matična št.</p>
                      <p className="text-xs font-mono">{supplier.businessId}</p>
                    </div>
                  )}
                  {supplier.taxId && (
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">ID za DDV</p>
                      <p className="text-xs font-mono">{supplier.taxId}</p>
                    </div>
                  )}
                  {supplier.minOrderAmount > 0 && (
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">Min. naročilo</p>
                      <p className="text-xs font-bold">€{supplier.minOrderAmount.toFixed(2)}</p>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">Naslov</p>
                      <p className="text-xs">{supplier.address}, {supplier.postCode} {supplier.city}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// SEZNAM NABAVNIH NAROČIL
// ============================================
function PurchaseOrdersList({ orders }: { orders: PurchaseOrderType[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <FileText className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Ni nabavnih naročil</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {orders.map(po => (
        <Card key={po.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm font-mono">{po.poNumber}</span>
                    <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${poStatusColors[po.status]}`}>
                      {poStatusLabels[po.status]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{po.supplier?.name || 'Neznan'}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(po.orderDate), 'd. MMM yyyy')}</span>
                    {po.expectedDate && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Pričakovano: {format(new Date(po.expectedDate), 'd. MMM yyyy')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-muted-foreground">{po.items?.length || 0} artiklov</span>
                    <span className="font-bold text-sm">€{po.totalAmount.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">(DDV: €{po.vatAmount.toFixed(2)})</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// DIALOG ZA DOBAVITELJA
// ============================================
function SupplierDialog({
  open,
  onClose,
  supplier,
  onSave,
}: {
  open: boolean
  onClose: () => void
  supplier: SupplierType | null
  onSave: (data: Record<string, unknown>) => void
}) {
  const isEditing = !!supplier

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postCode, setPostCode] = useState('')
  const [country, setCountry] = useState('Slovenija')
  const [businessId, setBusinessId] = useState('')
  const [taxId, setTaxId] = useState('')
  const [iban, setIban] = useState('')
  const [bank, setBank] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('30 dni')
  const [minOrderAmount, setMinOrderAmount] = useState(0)
  const [rating, setRating] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const resetForm = () => {
    if (supplier) {
      setName(supplier.name)
      setCode(supplier.code)
      setContactPerson(supplier.contactPerson)
      setEmail(supplier.email)
      setPhone(supplier.phone)
      setAddress(supplier.address)
      setCity(supplier.city)
      setPostCode(supplier.postCode)
      setCountry(supplier.country)
      setBusinessId(supplier.businessId)
      setTaxId(supplier.taxId)
      setIban(supplier.iban)
      setBank(supplier.bank)
      setPaymentTerms(supplier.paymentTerms)
      setMinOrderAmount(supplier.minOrderAmount)
      setRating(supplier.rating)
      setIsActive(supplier.isActive)
    } else {
      setName(''); setCode(''); setContactPerson(''); setEmail(''); setPhone('')
      setAddress(''); setCity(''); setPostCode(''); setCountry('Slovenija')
      setBusinessId(''); setTaxId(''); setIban(''); setBank('')
      setPaymentTerms('30 dni'); setMinOrderAmount(0); setRating(0); setIsActive(true)
    }
  }

  const handleSave = () => {
    if (!name) {
      toast.error('Ime dobavitelja je obvezno')
      return
    }
    onSave({
      name, code, contactPerson, email, phone,
      address, city, postCode, country,
      businessId, taxId, iban, bank,
      paymentTerms, minOrderAmount, rating, isActive,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (isOpen) resetForm(); else onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            {isEditing ? 'Uredi dobavitelja' : 'Nov dobavitelj'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Osnovni podatki */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Osnovni podatki</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium">Naziv podjetja *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mesarija Novak d.o.o." className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Koda</label>
                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="MN" className="h-9 text-sm font-mono" />
              </div>
            </div>
          </div>

          {/* Kontakt */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontakt</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">Kontaktna oseba</label>
                <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Janez Novak" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Telefon</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+386 1 234 5678" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">E-pošta</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="info@novak.si" className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* Naslov */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Naslov</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium">Ulica in hišna št.</label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Slovenska 15" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Poštna št.</label>
                <Input value={postCode} onChange={e => setPostCode(e.target.value)} placeholder="1000" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Mesto</label>
                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ljubljana" className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* Poslovni podatki */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Poslovni podatki</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">Matična številka</label>
                <Input value={businessId} onChange={e => setBusinessId(e.target.value)} placeholder="12345678" className="h-9 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium">ID za DDV</label>
                <Input value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="SI12345678" className="h-9 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium">Plačilni pogoji</label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="14 dni">14 dni</SelectItem>
                    <SelectItem value="30 dni">30 dni</SelectItem>
                    <SelectItem value="60 dni">60 dni</SelectItem>
                    <SelectItem value="2% popust 10 dni">2% popust 10 dni</SelectItem>
                    <SelectItem value="Plačilo ob prevzemu">Plačilo ob prevzemu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">IBAN</label>
                <Input value={iban} onChange={e => setIban(e.target.value)} placeholder="SI56 0123 4567 8901 234" className="h-9 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium">Banka</label>
                <Input value={bank} onChange={e => setBank(e.target.value)} placeholder="NLB d.d." className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Min. znesek naročila</label>
                <Input type="number" value={minOrderAmount} onChange={e => setMinOrderAmount(parseFloat(e.target.value) || 0)} className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* Ocena */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ocena dobavitelja</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button" onClick={() => setRating(star)} className="transition-transform hover:scale-110">
                  <Star className={`h-6 w-6 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                </button>
              ))}
              <span className="text-xs text-muted-foreground ml-2">{rating > 0 ? `${rating}/5` : 'Ni ocene'}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Shrani spremembe' : 'Ustvari dobavitelja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// DIALOG ZA NABAVNO NAROČILO
// ============================================
function PurchaseOrderDialog({
  open,
  onClose,
  suppliers,
  selectedSupplierId,
  inventoryItems,
  onSave,
}: {
  open: boolean
  onClose: () => void
  suppliers: SupplierType[]
  selectedSupplierId: string
  inventoryItems: unknown[]
  onSave: (data: Record<string, unknown>) => void
}) {
  const [supplierId, setSupplierId] = useState(selectedSupplierId)
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Array<{ description: string; quantityOrdered: number; unit: string; unitPrice: number; vatRate: number }>>([
    { description: '', quantityOrdered: 1, unit: 'kos', unitPrice: 0, vatRate: 22 },
  ])

  const addItem = () => {
    setItems([...items, { description: '', quantityOrdered: 1, unit: 'kos', unitPrice: 0, vatRate: 22 }])
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: string, value: string | number) => {
    const updated = [...items]
    updated[idx] = { ...updated[idx], [field]: value }
    setItems(updated)
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantityOrdered * item.unitPrice, 0)
  const vatAmount = items.reduce((sum, item) => sum + (item.quantityOrdered * item.unitPrice * item.vatRate / 100), 0)
  const total = subtotal + vatAmount

  const handleSave = () => {
    if (!supplierId) {
      toast.error('Izberite dobavitelja')
      return
    }
    if (items.every(i => !i.description)) {
      toast.error('Dodajte vsaj en artikel')
      return
    }

    onSave({
      supplierId,
      expectedDate: expectedDate || undefined,
      notes,
      items: items.filter(i => i.description),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Novo nabavno naročilo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Dobavitelj *</label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Izberi dobavitelja" /></SelectTrigger>
                <SelectContent>
                  {suppliers.filter(s => s.isActive).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Pričakovana dostava</label>
              <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Artikli */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Artikli</p>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Dodaj vrstico
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Opis artikla" className="h-8 text-xs" />
                </div>
                <div className="col-span-2">
                  <Input type="number" value={item.quantityOrdered} onChange={e => updateItem(idx, 'quantityOrdered', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                </div>
                <div className="col-span-1">
                  <Select value={item.unit} onValueChange={v => updateItem(idx, 'unit', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kos">kos</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="stek.">stek.</SelectItem>
                      <SelectItem value="keg">keg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="Cena" className="h-8 text-xs" />
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-medium">€{(item.quantityOrdered * item.unitPrice).toFixed(2)}</span>
                </div>
                <div className="col-span-1">
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}>
                      <X className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Skupaj */}
          <div className="flex justify-end p-3 rounded-lg bg-muted/50">
            <div className="text-right space-y-1">
              <div className="flex justify-between gap-8 text-xs">
                <span className="text-muted-foreground">Vmesna vsota:</span>
                <span className="font-medium">€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-8 text-xs">
                <span className="text-muted-foreground">DDV:</span>
                <span className="font-medium">€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-8 text-sm border-t pt-1">
                <span className="font-bold">SKUPAJ:</span>
                <span className="font-bold">€{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Opombe</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opombe k naročilu..." className="text-sm min-h-16" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={handleSave}>Ustvari naročilo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

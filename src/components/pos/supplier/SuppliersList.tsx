'use client'

// ============================================
// SEZNAM DOBAVITELJEV — Prikaz in razširitev
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Truck, Phone, Mail, MapPin, Building2, Star, Edit, FileText, Clock, ChevronDown, ChevronUp, Hash } from 'lucide-react'
import type { SupplierType } from './constants'

interface SuppliersListProps {
  suppliers: SupplierType[]
  expandedId: string | null
  onToggleExpand: (_id: string) => void
  onEdit: (_s: SupplierType) => void
  onCreatePO: (_supplierId: string) => void
}

export const SuppliersList = memo(function SuppliersList({
  suppliers,
  expandedId,
  onToggleExpand,
  onEdit,
  onCreatePO,
}: SuppliersListProps) {
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
                      <div className="flex items-center gap-0.5" aria-hidden="true">
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
                <Button variant="ghost" size="icon" aria-label="Uredi" className="h-7 w-7" onClick={() => onEdit(supplier)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Razširi" className="h-7 w-7" onClick={() => onToggleExpand(supplier.id)}>
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
                      <p className="text-xs font-bold">&euro;{supplier.minOrderAmount.toFixed(2)}</p>
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
})

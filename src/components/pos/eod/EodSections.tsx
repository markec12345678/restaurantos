'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, Banknote, DollarSign, Receipt, Shield, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import type { EodSectionsProps } from './constants'

// ============================================
// EOD SECTIONS - Razširljivi razdelki (Naročila, Plačila, DDV, FURS, Top artikli)
// ============================================
export const EodSections = memo(function EodSections({
  data,
  expandedSections,
  onToggleSection,
}: EodSectionsProps) {
  return (
    <>
      {/* ── Naročila ──────────────────────────────── */}
      <Card>
        <CardHeader className="p-3 cursor-pointer" role="button" tabIndex={0} aria-expanded={expandedSections.has('orders')} onClick={() => onToggleSection('orders')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSection('orders') } }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" />Naročila</CardTitle>
            {expandedSections.has('orders') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedSections.has('orders') && (
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Skupaj</p>
                <p className="font-bold">{data.orders.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                <p className="text-xs text-muted-foreground">Zaključena</p>
                <p className="font-bold text-emerald-600">{data.orders.completed}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/10">
                <p className="text-xs text-muted-foreground">Preklicana</p>
                <p className="font-bold text-red-600">{data.orders.cancelled}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Povpr. naročilo</p>
                <p className="font-bold">&euro;{data.orders.avgOrderValue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Plačila ──────────────────────────────── */}
      <Card>
        <CardHeader className="p-3 cursor-pointer" role="button" tabIndex={0} aria-expanded={expandedSections.has('payments')} onClick={() => onToggleSection('payments')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSection('payments') } }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Plačila po metodi</CardTitle>
            {expandedSections.has('payments') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedSections.has('payments') && (
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {Object.entries(data.payments.byMethod).map(([method, info]) => (
                <div key={method} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    {method === 'cash' ? <Banknote className="h-4 w-4 text-green-600" /> :
                     method === 'card' ? <CreditCard className="h-4 w-4 text-blue-600" /> :
                     <DollarSign className="h-4 w-4 text-purple-600" />}
                    <span className="text-sm font-medium capitalize">{method === 'cash' ? 'Gotovina' : method === 'card' ? 'Kartica' : method}</span>
                    <span className="text-xs text-muted-foreground">({info.count}x)</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">&euro;{info.total.toFixed(2)}</p>
                    {info.tips > 0 && <p className="text-[10px] text-amber-600">Napitnine: &euro;{info.tips.toFixed(2)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── DDV ──────────────────────────────── */}
      <Card>
        <CardHeader className="p-3 cursor-pointer" role="button" tabIndex={0} aria-expanded={expandedSections.has('vat')} onClick={() => onToggleSection('vat')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSection('vat') } }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" />DDV po stopnjah</CardTitle>
            {expandedSections.has('vat') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CardHeader>
        {expandedSections.has('vat') && (
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {Object.entries(data.vat).map(([rate, info]) => (
                <div key={rate} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <span className="text-sm font-medium">DDV {rate}%</span>
                    <p className="text-xs text-muted-foreground">Osnova: &euro;{info.base.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">&euro;{info.vat.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">Skupaj: &euro;{(info.base + info.vat).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── FURS ──────────────────────────────── */}
      <Card className={data.furs.allVerified ? 'border-emerald-300 dark:border-emerald-800' : 'border-red-300 dark:border-red-800'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className={`h-5 w-5 ${data.furs.allVerified ? 'text-emerald-500' : 'text-red-500'}`} />
              <span className="font-bold text-sm">FURS davčno potrjevanje</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{data.furs.verified}</p>
                <p className="text-[9px] text-muted-foreground">Overjenih</p>
              </div>
              {data.furs.queued > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-600">{data.furs.queued}</p>
                  <p className="text-[9px] text-muted-foreground">V čakalni</p>
                </div>
              )}
              {data.furs.failed > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">{data.furs.failed}</p>
                  <p className="text-[9px] text-muted-foreground">Neuspešnih</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Top artikli ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-4 w-4" />Najbolj prodajani danes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{idx + 1}</span>
                  <span className="text-sm">{item.name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{item.quantity}x</span>
                  <span className="font-semibold">&euro;{item.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {data.topItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Ni prodaje danes</p>}
          </div>
        </CardContent>
      </Card>
    </>
  )
})

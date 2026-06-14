'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Receipt, AlertTriangle,
} from 'lucide-react'
import type { ReceiptTabProps } from './constants'

// --- Komponenta ---

export const ReceiptTab = memo(function ReceiptTab({
  form,
  updateField,
}: ReceiptTabProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Noga računa
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Besedilo, ki se izpiše na dnu vsakega računa. Pogosto se uporablja za zahvalo, informacije o garanciji ali kontaktne podatke.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Besedilo noge računa</Label>
          <textarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={form.receiptFooter || ''}
            onChange={e => updateField('receiptFooter', e.target.value)}
            placeholder="npr. Hvala za obisk! / Thank you for your visit!"
            maxLength={200}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Priporočamo največ 150 znakov za termični tisk</span>
            <span>{(form.receiptFooter || '').length}/200</span>
          </div>
        </div>

        {/* Predogled celotnega računa */}
        <Card className="max-w-xs mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-center">Predogled računa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-[10px] bg-white dark:bg-gray-950 text-black dark:text-gray-100 p-3 rounded border space-y-1">
              <div className="text-center">
                <p className="font-bold text-xs">{form.name || 'Naziv podjetja'}</p>
                <p>{form.address || 'Naslov'}</p>
                <p>{form.postCode} {form.city}</p>
                <p>{form.phone}</p>
                <div className="flex justify-between">
                  <span>MAT: {form.businessId || '--------'}</span>
                  <span>ID: {form.taxId || 'SI--------'}</span>
                </div>
                <p>Blagajna: {form.registerNumber || 'BLG-001'}</p>
              </div>
              <div className="border-t border-dashed pt-1">
                <p>Račun št.: R-2026-000001</p>
                <p>Datum: {new Date().toLocaleDateString('sl-SI')}</p>
              </div>
              <div className="border-t border-dashed pt-1">
                <div className="flex justify-between"><span>1x Testni artikel</span><span>10.00€</span></div>
                <div className="flex justify-between text-gray-500"><span>  1x 8.20€ + DDV 22%</span><span>osn.8.20 ddv.1.80</span></div>
              </div>
              <div className="border-t border-dashed pt-1">
                <div className="flex justify-between"><span>Vmesna vsota:</span><span>8.20€</span></div>
                <div className="flex justify-between"><span>DDV 22%:</span><span>1.80€</span></div>
                <div className="flex justify-between font-bold"><span>SKUPAJ:</span><span>10.00€</span></div>
              </div>
              <div className="border-t border-dashed pt-1 text-center">
                <p className="break-all">ZOI: ABCD1234-EFGH5678-IJKL</p>
                <p className="text-emerald-600">Davčno overjeno ✓</p>
              </div>
              {form.receiptFooter && (
                <div className="border-t border-dashed pt-1 text-center">
                  <p>{form.receiptFooter}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Storno račun info */}
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Storno račun
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              V primeru napake na računu se račun ne sme brisati ali spreminjati. Namesto tega se izda storno račun,
              ki razveljavi prvotnega. Storno račun mora vsebovati sklic na originalni račun in mora biti prav tako davčno overjen.
            </p>
            <div className="text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded-lg space-y-1">
              <p className="font-semibold text-red-700 dark:text-red-400">Pravila za storno:</p>
              <ul className="list-disc list-inside text-red-600 dark:text-red-400 space-y-0.5">
                <li>Storno račun mora biti izdan na isti dan kot original</li>
                <li>Mora vsebovati oznako &quot;STORNO&quot; in sklic na originalni račun</li>
                <li>Vrednost je enaka originalu, a z negativnim predznakom</li>
                <li>Mora biti davčno overjen pri FURS</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
})

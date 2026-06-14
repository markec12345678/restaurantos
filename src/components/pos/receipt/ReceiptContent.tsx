'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, AlertTriangle, Shield, Banknote, CreditCard, Smartphone } from 'lucide-react'
import { format } from 'date-fns'
import { TYPE_LABELS, PAYMENT_LABELS } from './constants'
import type { ReceiptContentProps } from './constants'

// ============================================
// VSEBINA RAČUNA (tiskalno območje)
// ============================================
export const ReceiptContent = memo(function ReceiptContent({
  receipt,
  qrCodeDataUrl,
}: ReceiptContentProps) {
  // Ikone načina plačila
  const paymentIcons: Record<string, React.ReactNode> = {
    gotovina: <Banknote className="h-3 w-3" />,
    kartica: <CreditCard className="h-3 w-3" />,
    mobilno: <Smartphone className="h-3 w-3" />,
    cash: <Banknote className="h-3 w-3" />,
    card: <CreditCard className="h-3 w-3" />,
    mobile: <Smartphone className="h-3 w-3" />,
  }

  return (
    <div className="print-area" id="receipt-print">
      <div className="font-mono text-xs space-y-3">
        {/* GLAVA - Podatki izdajatelja */}
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold">{receipt.businessName}</h2>
          <p className="text-[10px] text-muted-foreground">{receipt.businessAddress}</p>
          <p className="text-[10px] text-muted-foreground">{receipt.phone}</p>
          <div className="flex justify-center gap-3 text-[10px]">
            <span>MAT: {receipt.businessId}</span>
            <span>ID DDV: {receipt.taxId}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Blagajna: {receipt.registerId}</p>
        </div>

        <Separator className="border-dashed" />

        {/* Podatki računa */}
        <div className="space-y-0.5 text-[11px]">
          <div className="flex justify-between font-semibold">
            <span>Račun št.:</span>
            <span>{receipt.receiptNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Datum:</span>
            <span>{format(new Date(receipt.receiptDate), 'dd.MM.yyyy HH:mm')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Naročilo:</span>
            <span>#{receipt.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vrsta:</span>
            <span>{TYPE_LABELS[receipt.type] || receipt.type}</span>
          </div>
          {receipt.table && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Miza:</span>
              <span>{receipt.table.number}</span>
            </div>
          )}
        </div>

        <Separator className="border-dashed" />

        {/* POSTAVKE - z DDV po artiklih */}
        <div className="space-y-2">
          {receipt.items.map((item) => (
            <div key={item.id} className="space-y-0.5">
              <div className="flex justify-between">
                <span className="font-semibold">{item.quantity}x {item.name}</span>
                <span className="font-semibold">{item.totalWithVat.toFixed(2)}€</span>
              </div>
              <div className="pl-4 flex justify-between text-[10px] text-muted-foreground">
                <span>{item.quantity}x {item.unitPrice.toFixed(2)}€ + DDV {item.vatRate}%</span>
                <span>osn.{item.basePrice.toFixed(2)}€ ddv.{item.vatAmount.toFixed(2)}€</span>
              </div>
              {item.modifiers.length > 0 && (
                <div className="pl-4">
                  {item.modifiers.map((mod, i) => (
                    <div key={i} className="flex justify-between text-[10px] text-muted-foreground">
                      <span>+ {mod.name}</span>
                      {mod.price && mod.price > 0 && <span>+{mod.price.toFixed(2)}€</span>}
                    </div>
                  ))}
                </div>
              )}
              {item.notes && (
                <p className="pl-4 text-[10px] text-amber-600 italic">* {item.notes}</p>
              )}
            </div>
          ))}
        </div>

        <Separator className="border-dashed" />

        {/* ZNESEKI z multi-DDV */}
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Vmesna vsota (brez DDV):</span>
            <span>{receipt.subtotal.toFixed(2)}€</span>
          </div>
          
          {/* DDV po stopnjah */}
          {Object.entries(receipt.vatBreakdown).map(([rate, data]) => (
            <div key={rate} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground pl-2">DDV {rate}% osnova:</span>
                <span className="text-muted-foreground">{data.base.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span className="pl-2">DDV {rate}%:</span>
                <span>{data.vat.toFixed(2)}€</span>
              </div>
            </div>
          ))}

          <div className="flex justify-between font-medium">
            <span>Skupaj DDV:</span>
            <span>{receipt.totalVat.toFixed(2)}€</span>
          </div>

          {receipt.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Popust:</span>
              <span>-{receipt.discount.toFixed(2)}€</span>
            </div>
          )}
          
          <Separator className="border-dashed my-1" />
          
          <div className="flex justify-between text-sm font-bold">
            <span>SKUPAJ Z DDV:</span>
            <span>{receipt.total.toFixed(2)}€</span>
          </div>

          {receipt.tip > 0 && (
            <>
              <div className="flex justify-between">
                <span>Napitnina:</span>
                <span>{receipt.tip.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>SKUPAJ Z NAPITNINO:</span>
                <span>{receipt.totalWithTip.toFixed(2)}€</span>
              </div>
            </>
          )}
        </div>

        {/* Plačilne informacije */}
        <Separator className="border-dashed" />
        <div className="space-y-0.5">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Način plačila:</span>
            <div className="flex items-center gap-1">
              {paymentIcons[receipt.paymentMethod]}
              <span className="font-semibold">
                {PAYMENT_LABELS[receipt.paymentMethod] || receipt.paymentMethod}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status:</span>
            <Badge
              variant={receipt.paymentStatus === 'paid' ? 'default' : 'outline'}
              className={`text-[10px] h-5 ${
                receipt.paymentStatus === 'paid'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : ''
              }`}
            >
              {receipt.paymentStatus === 'paid' ? (
                <><CheckCircle2 className="h-3 w-3 mr-0.5" /> Plačano</>
              ) : (
                'Čaka na plačilo'
              )}
            </Badge>
          </div>
        </div>

        {/* FURS podatki */}
        <Separator className="border-dashed" />
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-blue-500" />
            <span className="text-muted-foreground">ZOI:</span>
            <span className="font-mono text-[9px] break-all">{receipt.zoi}</span>
          </div>
          {receipt.eor && (
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-blue-500" />
              <span className="text-muted-foreground">EOR:</span>
              <span className="font-mono text-[9px] break-all">{receipt.eor}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {receipt.fiscalVerified ? (
              <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> <span className="text-emerald-600">Davčno overjeno</span></>
            ) : (
              <><AlertTriangle className="h-3 w-3 text-amber-500" /> <span className="text-amber-600">Čaka na davčno overjanje (FURS)</span></>
            )}
          </div>
        </div>

        {/* FURS QR koda */}
        <div className="flex justify-center">
          {receipt.fiscalVerified && qrCodeDataUrl ? (
            <div className="space-y-1 text-center">
              <img 
                src={qrCodeDataUrl} 
                alt="FURS QR koda" 
                className="h-24 w-24 mx-auto"
              />
              <p className="text-[8px] text-muted-foreground">FURS preverjanje</p>
            </div>
          ) : receipt.fiscalVerified ? (
            <div className="h-24 w-24 border-2 border-current rounded flex items-center justify-center">
              <div className="text-center text-[8px] text-muted-foreground">
                <Shield className="h-4 w-4 mx-auto mb-0.5" />
                FURS QR
              </div>
            </div>
          ) : (
            <div className="h-24 w-24 border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center">
              <div className="text-center text-[8px] text-muted-foreground/50">
                <Shield className="h-4 w-4 mx-auto mb-0.5" />
                QR po overitvi
              </div>
            </div>
          )}
        </div>

        {/* Noga računa */}
        {receipt.receiptFooter && (
          <div className="text-center text-[10px] text-muted-foreground pt-1">
            <p>{receipt.receiptFooter}</p>
          </div>
        )}
      </div>
    </div>
  )
})

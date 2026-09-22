'use client'

// ============================================
// Z-POROČILO TISKALNI DOKUMENT (runda 74)
// ============================================
// Print-only fiskalno oblikovan dokument: skrit na zaslonu
// (hidden print:block), pri tisku edini vidni element prek
// globalnega .print-area vzorca (globals.css — isti mehanizem
// kot račun na /receipt).
//
// Stil (obvezna stilna izboljšava): fiskalni izgled — monospace,
// pikčaste vodilne črt med oznako in zneskom, črtkani ločilniki
// sekcij, žig stanja (OSNUTEK/ZAKLJUČENO), print-color-adjust: exact
// za akcente, FURS/FINA disklejmer v nogi.
//
// Podatki: lib/z-report-print.ts buildZPrintModel (čista lib, R74).

import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { createPortal } from 'react-dom'
import { buildZPrintModel, type ZReportPrintInput } from '@/lib/z-report-print'

export interface ZPrintDocumentProps {
  report: ZReportPrintInput | null | undefined
}

// Pikčasta vodilna črta: flex-1 element z border-dotted na dnu
function LeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5" data-testid="zprint-row">
      <span className="shrink-0">{label}</span>
      <span aria-hidden="true" className="min-w-4 flex-1 border-b border-dotted border-neutral-400" />
      <span className="shrink-0 tabular-nums font-semibold">{value}</span>
    </div>
  )
}

// Delež % po SL pravilih ročno (R71 lekcija: NE toLocaleString — small-ICU past tudi na klientu)
function formatPctSl(p: number): string {
  return String(p).replace('.', ',')
}

// Deležna vrstica (metode/kanali): znesek + (delež %); kanali so tonirano
// svetlejši (vizualna hijerarhija: metode > kanali)
function ShareRow({
  label,
  amount,
  sharePct,
  tone,
}: {
  label: string
  amount: string
  sharePct: number | null
  tone: 'default' | 'muted'
}) {
  const share = sharePct != null ? ` (${formatPctSl(sharePct)} %)` : ''
  return (
    <div className={tone === 'muted' ? 'text-neutral-600' : undefined}>
      <LeaderRow label={`${label}${share}`} value={amount} />
    </div>
  )
}

export function ZPrintDocument({ report }: ZPrintDocumentProps) {
  const m = buildZPrintModel(report)
  const generatedAt = format(new Date(), 'd. MM. yyyy HH:mm', { locale: sl })

  // R74: PORTAL na document.body — Z-report živi znotraj POS lupine z
  // overflow-hidden verigo + framer-motion transform (motion.div ustvari
  // containing block) → globalni .print-absolutni top:0/left:0 bi bil
  // premaknjen + ODSKETAN na višino lupine (večstranski tisk zlomljen).
  // Portal pobegne vsem prednikom: containing block = začetni (body) —
  // enako zanesljivo kot /receipt (samostojna stran).
  if (typeof document === 'undefined') return null // ssr:false dynamic, varnost

  return createPortal(
    <div
      className="print-area hidden bg-white font-mono text-[11px] leading-relaxed text-neutral-900 print:block"
      data-testid="zprint-document"
    >
      {/* Glava — blagovna znamka + žig stanja */}
      <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-2">
        <div>
          <div className="text-base font-bold tracking-widest">RESTAURANT OS</div>
          <div className="mt-0.5 text-[13px] font-bold uppercase">Z-poročilo — dnevni zaključek</div>
          <div className="text-neutral-700">{m.dateLabel}</div>
        </div>
        <div
          data-testid="zprint-status"
          className={`shrink-0 rotate-3 rounded border-2 px-2 py-1 text-[13px] font-bold tracking-widest ${
            m.statusTone === 'finalized'
              ? 'border-emerald-700 text-emerald-700 print:border-emerald-700 print:text-emerald-700'
              : 'border-amber-600 text-amber-700 print:border-amber-600 print:text-amber-700'
          }`}
          style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        >
          {m.statusLabel}
        </div>
      </div>

      {/* Meta: odprto / zaprto */}
      <div className="flex flex-wrap gap-x-6 py-1.5 text-neutral-700">
        {m.metaRows.map((row) => (
          <span key={row.label}>
            {row.label}: <span className="tabular-nums text-neutral-900">{row.value}</span>
          </span>
        ))}
      </div>

      {/* Povzetek dneva */}
      <div className="mt-1 border-y border-dashed border-neutral-500 py-1.5">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-600">Povzetek dneva</div>
        {m.summaryRows.map((row) => (
          <LeaderRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>

      {/* DDV po stopnjah */}
      {m.vatRows.length > 0 && (
        <div className="mt-2" data-testid="zprint-vat">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-600">DDV po stopnjah</div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-dotted border-neutral-400 text-left text-[10px] uppercase text-neutral-600">
                <th className="py-0.5 font-semibold">Stopnja</th>
                <th className="py-0.5 text-right font-semibold">Osnova</th>
                <th className="py-0.5 text-right font-semibold">DDV</th>
              </tr>
            </thead>
            <tbody>
              {m.vatRows.map((row) => (
                <tr key={row.label} className="border-b border-dotted border-neutral-300 last:border-0">
                  <td className="py-0.5">{row.label}</td>
                  <td className="py-0.5 text-right tabular-nums">{row.base}</td>
                  <td className="py-0.5 text-right tabular-nums font-semibold">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Metode plačila */}
      {m.paymentRows.length > 0 && (
        <div className="mt-2" data-testid="zprint-payments">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-600">Metode plačila</div>
          {m.paymentRows.map((row) => (
            <ShareRow key={row.label} {...row} />
          ))}
        </div>
      )}

      {/* Prodajni kanali */}
      {m.channelRows.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-600">Prodajni kanali</div>
          {m.channelRows.map((row) => (
            <ShareRow key={row.label} {...row} />
          ))}
        </div>
      )}

      {/* Blagajna — reconciliacija */}
      <div className="mt-2 border-y border-dashed border-neutral-500 py-1.5">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-600">Blagajna</div>
        {m.cashRows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-2 py-0.5">
            <span className="shrink-0">{row.label}</span>
            <span aria-hidden="true" className="min-w-4 flex-1 border-b border-dotted border-neutral-400" />
            <span className="shrink-0 tabular-nums font-semibold">{row.amount}</span>
          </div>
        ))}
        {m.cashDifference && (
          <div className="mt-1 flex items-baseline gap-2 border-t border-dotted border-neutral-400 pt-1 font-bold">
            <span className="shrink-0">Razlika</span>
            <span aria-hidden="true" className="min-w-4 flex-1 border-b border-dotted border-neutral-400" />
            <span
              data-testid="zprint-diff"
              className={`shrink-0 rounded px-1.5 tabular-nums ${
                m.cashDifference.kind === 'surplus'
                  ? 'bg-emerald-100 text-emerald-800'
                  : m.cashDifference.kind === 'missing'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-neutral-200 text-neutral-700'
              }`}
              style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
            >
              {m.cashDifference.kind === 'even' ? 'uravnoteženo' : `${m.cashDifference.value} €`}
            </span>
          </div>
        )}
      </div>

      {/* Dodatki + dobiček */}
      {(m.extraRows.length > 0 || m.profitRow) && (
        <div className="mt-2">
          {m.extraRows.map((row) => (
            <LeaderRow key={row.label} label={row.label} value={row.value} />
          ))}
          {m.profitRow && <LeaderRow label={m.profitRow.label} value={m.profitRow.value} />}
        </div>
      )}

      {/* Opombe */}
      {m.notes && (
        <div className="mt-2 border border-dotted border-neutral-400 p-1.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">Opombe</div>
          <div className="whitespace-pre-wrap">{m.notes}</div>
        </div>
      )}

      {/* Noga — disklejmer + čas tiska */}
      <div className="mt-3 border-t-2 border-neutral-900 pt-1.5 text-[9px] leading-snug text-neutral-600">
        <div>{m.footer}</div>
        <div className="mt-0.5">Natisnjeno: {generatedAt} · RestaurantOS</div>
      </div>
      </div>,
    document.body
  )
}

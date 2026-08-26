// ============================================
// eDavki XML GENERATOR — XML za FURS predajo DDV poročila
// Ustvari XML v formatu, združljivem z eDavki portalom (DDV-O obrazec)
// ============================================

import type { ReportData } from './report-data'
import { round2 } from '@/lib/decimal'

const escapeXml = (s: string | number): string =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/**
 * Generiraj eDavki XML (DDV-O obrazec) za FURS predajo.
 *
 * Struktura sledi eDavki DDV-O shemi:
 * - davcnaStevilka (nastavi iz env RestaurantSettings/Location)
 * - obdobje (leto + mesec)
 * - postavke po DDV stopnjah (S=22%, R=9.5%, Z=0%)
 * - skupni promet in DDV
 *
 * Opomba: Za formalno predajo na eDavki portal je potrebno digitalno
 * podpisati XML z namenskim certifikatom (eDavki SSE). Ta generator
 * ustvari surov XML — podpis se izvede ločeno pred uploadom.
 */
export function generateEdavkiXml(data: ReportData, opts: { taxNumber?: string; taxpayerName?: string }): string {
  const now = new Date(data.generatedAt)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  // DDV postavke po stopnjah (eDavki pričakuje vrstni red: 22% S, 9.5% R, 0% Z)
  const sorted = [...data.vatBreakdown].sort((a, b) => b.rate - a.rate)

  const postavkeXml = sorted.map(v => {
    const sifra = v.code === 'S' ? 'STD' : v.code === 'R' ? 'NJN' : 'OPR'
    return `    <Postavka>
      <SifraPostavke>${sifra}</SifraPostavke>
      <VrstaPostavke>2</VrstaPostavke>
      <Stopnja>${v.rate.toFixed(2)}</Stopnja>
      <Osnova>${v.baseAmount.toFixed(2)}</Osnova>
      <ZnesekDDV>${v.vatAmount.toFixed(2)}</ZnesekDDV>
      <VrednostZDDV>${v.totalAmount.toFixed(2)}</VrednostZDDV>
    </Postavka>`
  }).join('\n')

  const totalBase = round2(data.vatBreakdown.reduce((s, v) => s + v.baseAmount, 0))
  const totalVat = round2(data.vatBreakdown.reduce((s, v) => s + v.vatAmount, 0))
  const totalWithVat = round2(data.vatBreakdown.reduce((s, v) => s + v.totalAmount, 0))

  const taxNum = opts.taxNumber || '00000000'
  const taxpayer = opts.taxpayerName || 'RestaurantOS'

  return `<?xml version="1.0" encoding="UTF-8"?>
<envelope xmlns="http://edavki.durs.si/Documents/Schemas/Doh_DdvO_2.xsd">
  <DohDdvO>
    <Period>${year}${month}</Period>
    <DatumIzdelave>${now.toISOString().split('T')[0]}</DatumIzdelave>
    <DavcnaStevilka>${escapeXml(taxNum)}</DavcnaStevilka>
    <ImeZavezanca>${escapeXml(taxpayer)}</ImeZavezanca>
    <VrstaDokumenta>Izvenobdobjna</VrstaDokumenta>
    <Postavke>
${postavkeXml}
    </Postavke>
    <Skupaj>
      <OsnovaSkupaj>${totalBase.toFixed(2)}</OsnovaSkupaj>
      <DDVSkupaj>${totalVat.toFixed(2)}</DDVSkupaj>
      <PrometZDDV>${totalWithVat.toFixed(2)}</PrometZDDV>
    </Skupaj>
    <Placilo>
      <DDVzaPlacilo>${totalVat.toFixed(2)}</DDVzaPlacilo>
      <Preplacilo>0.00</Preplacilo>
      <ZaPlacilo>${totalVat.toFixed(2)}</ZaPlacilo>
    </Placilo>
    <Komentar>Avtomatsko generirano poročilo RestaurantOS — obdobje ${data.startDate || 'vse'} do ${data.endDate || 'vse'}</Komentar>
  </DohDdvO>
</envelope>`
}

'use client'

import { memo } from 'react'
import {
  AlertTriangle, CheckCircle2, TestTube2,
  FileText, Wifi,
} from 'lucide-react'
import { getCountryConfig } from '@/lib/country-config'
import type { CountryCode } from '@/lib/country-config'

// ============================================
// CONNECTION STATUS PANEL — Status povezave FURS
// ============================================
interface ConnectionStatusPanelProps {
  fursStatus: string
  environment: string
  onTestFursConnection: () => void
}

export const ConnectionStatusPanel = memo(function ConnectionStatusPanel({
  fursStatus, environment, onTestFursConnection,
}: ConnectionStatusPanelProps) {  return (
    <div className={`rounded-lg p-4 border-2 ${
      fursStatus === 'connected' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800' :
      fursStatus === 'testing' ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800' :
      fursStatus === 'error' ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800' :
      'border-muted bg-muted/50'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {fursStatus === 'connected' ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          ) : fursStatus === 'testing' ? (
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : fursStatus === 'error' ? (
            <AlertTriangle className="h-6 w-6 text-red-600" />
          ) : (
            <Wifi className="h-6 w-6 text-muted-foreground" />
          )}
          <div>
            <p className="font-semibold">
              {fursStatus === 'connected' ? 'Povezava vzpostavljena' :
               fursStatus === 'testing' ? 'Preverjam povezavo...' :
               fursStatus === 'error' ? 'Povezava neuspešna' :
               'Povezava ni vzpostavljena'}
            </p>
            <p className="text-xs text-muted-foreground">
              Okolje: {environment === 'production' ? 'PRODUKCIJA' : 'TESTNO'}
            </p>
          </div>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          onClick={onTestFursConnection}
          disabled={fursStatus === 'testing'}
        >
          <TestTube2 className="h-4 w-4 mr-2" />
          Testiraj povezavo
        </button>
      </div>
    </div>
  )
})

// ============================================
// FISCALIZATION INFO CARD — Informacije o fiskalizaciji
// ============================================
export const FiscalizationInfoCard = memo(function FiscalizationInfoCard({ currentCountryCode }: { currentCountryCode: CountryCode }) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)
  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
      <h4 className="font-semibold text-blue-800 dark:text-blue-300">
        {currentCountryConfig.flag} Kaj morate vedeti o fiskalizaciji v {currentCountryConfig.nameLocal}
      </h4>
      <div className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
        <p><strong>{currentCountryConfig.fiscalization.system}</strong> ({currentCountryConfig.fiscalization.systemLocal}) —
          fiskalizacijski sistem v {currentCountryConfig.nameLocal}. Organ: {currentCountryConfig.fiscalization.authority}.</p>
        <p><strong>{currentCountryConfig.fiscalization.receiptCodes.protectionCode}</strong> —
          zaščitna koda na računu, generirana iz digitalnega podpisa s certifikatom ({currentCountryConfig.fiscalization.certificateFormat}).</p>
        <p><strong>{currentCountryConfig.fiscalization.receiptCodes.verificationCode}</strong> —
          verifikacijska koda, ki jo vrne strežnik {currentCountryConfig.fiscalization.authorityShort} kot potrditev sprejema računa.</p>
        {currentCountryCode === 'SI' && (
          <>
            <p><strong>ZOI</strong> (Zaščitni označitelj izdajanja) — Base64 kodiran podpis, generiran iz RSA-SHA256 z uporabo FURS certifikata.</p>
            <p><strong>EOR</strong> (Elektronski zapis o računu) — UUID, ki ga vrne FURS strežnik kot potrditev. Vrne se v 3 sekundah.</p>
            <p><strong>Kazen:</strong> Za neoverjene račune grozi globo od 500 do 125.000 EUR (ZDDV-1, 85. člen).</p>
          </>
        )}
        {currentCountryCode === 'HR' && (
          <>
            <p><strong>JIR</strong> (Jedinstveni identifikator računa) — UUID generiran od strane Porezne uprave.</p>
            <p><strong>ZKI</strong> (Zaštitni kod izdavatelja) — digitalni potpis računa, obavezno prikazan na računu.</p>
            <p><strong>Kazna:</strong> Za neizdane ili nefiskalizirane račune kazna od 5.000 do 500.000 HRK.</p>
          </>
        )}
        {currentCountryCode === 'IT' && (
          <>
            <p><strong>Sistema TS</strong> — Tehničko rješenje za fiskalizaciju u Italiji.</p>
            <p><strong>SDI</strong> (Sistema di Interscambio) — elektronska razmjena dokumenata.</p>
          </>
        )}
        {currentCountryCode === 'AT' && (
          <>
            <p><strong>RKSV</strong> — Registrierkassensicherungsverordnung, obavezna za sve austrijske poslovne subjekte.</p>
            <p><strong>DEP</strong> (Digitales Exportprotokoll) — digitalni zapis svih transakcija.</p>
          </>
        )}
        {currentCountryCode === 'DE' && (
          <>
            <p><strong>KassensichV</strong> — Kassensicherungsverordnung, savezni propis o sigurnosti blagajni.</p>
            <p><strong>TSE</strong> (Technische Sicherheitseinrichtung) — sigurnosni modul (SD kartica, USB ili Cloud).</p>
            <p><strong>DSFinV-K</strong> — Digitalna sučelje za izvoz podataka s blagajne.</p>
          </>
        )}
        <p><strong>Produkcijski način:</strong> Za prehod v produkcijo morate imeti veljaven certifikat in pravilno konfigurirane podatke podjetja.</p>
      </div>
    </div>
  )
})

// ============================================
// RECEIPT REQUIREMENTS CARD — Obvezni podatki na računu
// ============================================
export const ReceiptRequirementsCard = memo(function ReceiptRequirementsCard({ currentCountryCode }: { currentCountryCode: CountryCode }) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6 pb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Obvezni podatki na računu ({currentCountryConfig.flag} {currentCountryConfig.nameLocal})
        </h3>
      </div>
      <div className="p-6 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="font-semibold text-sm">Podatki izdajatelja:</p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {currentCountryConfig.receiptRequirements.slice(0, Math.ceil(currentCountryConfig.receiptRequirements.length / 2)).map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-sm">Podatki računa:</p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {currentCountryConfig.receiptRequirements.slice(Math.ceil(currentCountryConfig.receiptRequirements.length / 2)).map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
})

'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Shield, Info, Send, Loader2, CheckCircle2, XCircle, FileCode2 } from 'lucide-react'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'
import type { CisTabProps } from './constants'
import { ConnectionStatusPanel, ReceiptRequirementsCard } from './FursSubComponents'
import { CisCertificateFields } from './CisCertificateFields'
import type { CisSendResponse } from './cis-send-status'

// ============================================
// CIS INFO CARD — Kaj morate vedeti o CIS fiskalizaciji (Hrvaška)
// Namenska HR kartica (rdeč poudarek, ločevanje od FURS modre).
// FiscalizationInfoCard v FursSubComponents ostane nedotaknjena —
// uporablja jo FursTab za vse druge države.
// ============================================
const CisInfoCard = memo(function CisInfoCard({ countryCode }: { countryCode: CountryCode }) {
  const config = getCountryConfig(countryCode)
  return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3">
      <h4 className="font-semibold text-red-800 dark:text-red-300">
        {config.flag} Kaj morate vedeti o CIS fiskalizaciji
      </h4>
      <div className="text-sm text-red-700 dark:text-red-400 space-y-2">
        <p>
          <strong>ZKI</strong> (zaščitni kod izdavatelja, 32 hex znakov) — MD5 nad RSA-SHA256
          podpisom zaščitnega niza (OIB + datum/čas + št. računa + poslovni prostor +
          naplatna naprava + znesek). Obvezen podatek, ki se prikaže na računu.
        </p>
        <p>
          <strong>JIR</strong> (Jedinstveni identifikator računa) — UUID, ki ga vrne
          Porezna uprava kot potrditev sprejema računa.
        </p>
        <p>
          <strong>Specifikacija:</strong> Tehnička dokumentacija v2.7 (F73 namespace).
        </p>
        <p>
          <strong>Demo certifikat:</strong> FINA DigiCert portal (
          <a
            href="https://digicert.finastre.hr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-red-600 dark:hover:text-red-300"
          >
            digicert.finastre.hr
          </a>
          ) za testno okolje; produkcija: FINA (zahtevnost: ca-file + podpis).
        </p>
        <p>
          <strong>TLS:</strong> testno okolje uporablja privatno Fina Demo CA (vgrajena),
          produkcija javno CA verigo (vgrajena).
        </p>
        <p>
          <strong>Kazen:</strong> za nefiskalizirane račune glo od 5.000 do 500.000 EUR
          (Zakon o fiskalizaciji).
        </p>
      </div>
    </div>
  )
})

// ============================================
// CIS TEST INVOICE PANEL — sintetičen račun (10.00 €, 1/POS1/1, G) na
// Porezno upravo: ZKI + XML-dsig + SOAP POST + JIR parsing (runda 28).
// Brez P12: disabled gumb z navodilom. Rezultat: JIR (emerald) ali
// SifraGreske/PorukaGreske (rdeča) + razpognljiv XML predogled.
// ============================================
const CisTestInvoicePanel = memo(function CisTestInvoicePanel({
  sendStatus,
  result,
  onSend,
  hasCert,
}: {
  sendStatus: CisTabProps['cisSendStatus']
  result: CisSendResponse | null
  onSend: () => void
  hasCert: boolean
}) {
  const testing = sendStatus === 'testing'
  const ok = result?.ok === true && !!result?.jir

  return (
    <div className="rounded-lg border bg-muted/30 dark:bg-muted/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-red-600 dark:text-red-400" />
            Testna oddaja računa
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Sintetičen račun <strong>10.00 €</strong> (1/POS1/1, gotovina) na{' '}
            <strong>Porezno upravo</strong> — ZKI + XML-dsig + JIR. Ne piše v računovodski tok.
          </p>
        </div>
        <Button
          size="sm"
          onClick={onSend}
          disabled={testing || !hasCert}
          className="shrink-0 active:scale-95 transition-transform"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Oddaja…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Oddaj testni račun
            </>
          )}
        </Button>
      </div>

      {!hasCert && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Za oddajo naloži FINA P12 certifikat (pot + geslo) in shrani nastavitve —
          demo cert na{' '}
          <a
            href="https://digicert.finastre.hr"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            digicert.finastre.hr
          </a>.
        </p>
      )}

      {result && (
        <div
          className={
            ok
              ? 'rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-1'
              : 'rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 space-y-1'
          }
          role="status"
        >
          <div className="flex items-center gap-2">
            {ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            <span className="text-sm font-medium">
              {ok ? 'Fiskalizirano — JIR od Porezne uprave' : 'Oddaja zavrnjena / neuspešna'}
            </span>
          </div>
          {ok ? (
            <p className="font-mono text-base font-semibold text-emerald-700 dark:text-emerald-300 tracking-wide">
              {result.jir}
            </p>
          ) : (
            <p className="text-sm text-red-700 dark:text-red-300">
              {result.serverErrorCode ? `${result.serverErrorCode} — ` : ''}
              {result.errorMessage || 'Napaka brez opisa — poglej server log'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {result.environment === 'production' ? 'PRODUKCIJA' : 'TESTNO'}
            {typeof result.responseTime === 'number' ? ` · ${result.responseTime} ms` : ''}
            {result.idPoruke ? ` · ${result.idPoruke}` : ''}
            {result.zki ? ` · ZKI: ${result.zki}` : ''}
          </p>
        </div>
      )}

      {result?.signedEnvelope && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none flex items-center gap-1.5 hover:text-foreground transition-colors">
            <FileCode2 className="h-3.5 w-3.5" />
            Predogled podpisanega XML-a (RacunZahtjev + ds:Signature)
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-zinc-950 text-zinc-100 dark:bg-zinc-900 p-3 text-[11px] leading-relaxed font-mono">
            {result.signedEnvelope}
          </pre>
        </details>
      )}
    </div>
  )
})

// ============================================
// CIS TAB KOMPONENTA — Hrvaška fiskalizacija (Porezna uprava)
// Modelirano na FursTab.tsx; brez množične overitve (FURS-only).
// Runda 28: testna oddaja računa (sendRacunZahtjev wiring) — Echo deluje
// že od Task 23, polna oddaja zahteva FINA P12.
// ============================================
export const CisTab = memo(function CisTab({
  form,
  updateField,
  cisStatus,
  onTestCisConnection,
  cisSendStatus,
  cisSendResult,
  onSendCisTestInvoice,
  currentCountryCode,
}: CisTabProps) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-600" />
          CIS fiskalizacija ({currentCountryConfig.fiscalization.systemLocal})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {currentCountryConfig.flag} {currentCountryConfig.fiscalization.authority} —
          {currentCountryConfig.fiscalization.required ? ' Fiskalizacija je obvezna.' : ' Fiskalizacija ni obvezna.'}
        </p>
        <p className="text-sm text-muted-foreground">
          Za izračun ZKI in pridobitev JIR potrebujete veljaven FINA certifikat
          ({currentCountryConfig.fiscalization.certificateFormat}).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status povezave */}
        <ConnectionStatusPanel
          fursStatus={cisStatus}
          environment={form.cisEnvironment || 'test'}
          onTestFursConnection={onTestCisConnection}
        />

        {/* CIS Certifikat (FINA P12) */}
        <CisCertificateFields
          certPath={form.cisCertPath || ''}
          onCertPathChange={v => updateField('cisCertPath', v)}
          certPassword={form.cisCertPassword || ''}
          onCertPasswordChange={v => updateField('cisCertPassword', v)}
          environment={form.cisEnvironment || 'test'}
          onEnvironmentChange={v => updateField('cisEnvironment', v)}
          certificateFormat={currentCountryConfig.fiscalization.certificateFormat}
          authorityShort={currentCountryConfig.fiscalization.authorityShort}
          hasCert={form.hasCisCert}
        />

        {/* Testna oddaja računa (polna fiskalizacijska runda) */}
        <CisTestInvoicePanel
          sendStatus={cisSendStatus}
          result={cisSendResult}
          onSend={onSendCisTestInvoice}
          hasCert={!!form.hasCisCert}
        />

        <Separator />

        {/* Informacije o CIS fiskalizaciji */}
        <CisInfoCard countryCode={currentCountryCode} />

        {/* Kaj mora biti na računu */}
        <ReceiptRequirementsCard currentCountryCode={currentCountryCode} />

        {/* Opomba o testni oddaji */}
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          Testna oddaja pošlje sintetičen račun na Porezno upravo in prikaže realen odgovor
          (JIR ali napaka). Produkcijska vezava na plačilni tok (oddaja ob plačilu) pride ob
          produkcijskem P12 certifikatu.
        </p>
      </CardContent>
    </Card>
  )
})

'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Shield, Info } from 'lucide-react'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'
import type { CisTabProps } from './constants'
import { ConnectionStatusPanel, ReceiptRequirementsCard } from './FursSubComponents'
import { CisCertificateFields } from './CisCertificateFields'

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
// CIS TAB KOMPONENTA — Hrvaška fiskalizacija (Porezna uprava)
// Modelirano na FursTab.tsx; brez množične overitve (FURS-only).
// Polna fiskalizacija (RacunZahtjev + XML-dsig) še prihaja —
// povezljivostni test (Echo) deluje že zdaj.
// ============================================
export const CisTab = memo(function CisTab({
  form,
  updateField,
  cisStatus,
  onTestCisConnection,
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

        <Separator />

        {/* Informacije o CIS fiskalizaciji */}
        <CisInfoCard countryCode={currentCountryCode} />

        {/* Kaj mora biti na računu */}
        <ReceiptRequirementsCard currentCountryCode={currentCountryCode} />

        {/* Opomba o prihajajoči polni fiskalizaciji */}
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          Polna fiskalizacija (RacunZahtjev z ZKI + XML-dsig) prihaja — potrebujete FINA P12
          certifikat. Povezljivostni test (Echo) deluje že zdaj.
        </p>
      </CardContent>
    </Card>
  )
})

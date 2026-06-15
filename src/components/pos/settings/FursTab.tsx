'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Shield } from 'lucide-react'
import { getCountryConfig } from '@/lib/country-config'
import { FursBatchVerification } from './FursBatchVerification'
import type { FursTabProps } from './constants'
import { ConnectionStatusPanel, FiscalizationInfoCard, ReceiptRequirementsCard } from './FursSubComponents'
import { FursCertificateFields } from './FursCertificateFields'

// ============================================
// FURS TAB KOMPONENTA
// ============================================
export const FursTab = memo(function FursTab({
  form,
  updateField,
  fursStatus,
  onTestFursConnection,
  currentCountryCode,
}: FursTabProps) {
  const currentCountryConfig = getCountryConfig(currentCountryCode)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          {currentCountryConfig.fiscalization.systemLocal}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {currentCountryConfig.flag} {currentCountryConfig.fiscalization.authority} ({currentCountryConfig.fiscalization.authorityShort}) —
          {currentCountryConfig.fiscalization.required ? ' Fiskalizacija je obvezna.' : ' Fiskalizacija ni obvezna.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status povezave */}
        <ConnectionStatusPanel
          fursStatus={fursStatus}
          environment={form.fursEnvironment || 'test'}
          onTestFursConnection={onTestFursConnection}
        />

        {/* FURS Certifikat */}
        <FursCertificateFields
          certPath={form.fursCertPath || ''}
          onCertPathChange={v => updateField('fursCertPath', v)}
          certPassword={form.fursCertPassword || ''}
          onCertPasswordChange={v => updateField('fursCertPassword', v)}
          environment={form.fursEnvironment || 'test'}
          onEnvironmentChange={v => updateField('fursEnvironment', v)}
          certificateFormat={currentCountryConfig.fiscalization.certificateFormat}
          authorityShort={currentCountryConfig.fiscalization.authorityShort}
        />

        <Separator />

        {/* Množična overitev neoverjenih računov */}
        <FursBatchVerification />

        <Separator />

        {/* Informacije o fiskalizaciji */}
        <FiscalizationInfoCard currentCountryCode={currentCountryCode} />

        {/* Kaj mora biti na računu */}
        <ReceiptRequirementsCard currentCountryCode={currentCountryCode} />
      </CardContent>
    </Card>
  )
})

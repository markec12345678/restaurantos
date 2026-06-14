'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Upload, FileKey } from 'lucide-react'
import type { CertificateConfigProps } from './constants'

// ============================================
// KONFIGURACIJA CERTIFIKATA — Obrazec za p12/pfx
// ============================================

export const CertificateConfig = memo(function CertificateConfig({
  certPath,
  certPassword,
  environment,
  saving,
  onCertPathChange,
  onCertPasswordChange,
  onEnvironmentChange,
  onSave,
}: CertificateConfigProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileKey className="h-4 w-4" />
          Certifikat PKCS12 (p12/pfx)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-400">Pomembno za produkcijo</p>
              <p className="text-amber-700 dark:text-amber-500 mt-1">
                V produkciji MORA biti naložen pravi FURS p12 certifikat. Brez certifikata se računi overjajo simulirano, kar NI skladno z zakonom ZDDV-1.
                Certifikat pridobite na <a href="https://edavki.durs.si" target="_blank" className="underline">eDavki FURS</a>.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">Pot do certifikata (.p12 / .pfx / .pem)</label>
            <Input
              placeholder="/path/to/certifikat.p12"
              value={certPath}
              onChange={e => onCertPathChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Npr.: /home/z/certificates/furs-test.p12 ali C:\certs\furs.p12
            </p>
          </div>
          <div>
            <label htmlFor="furs-cert-password" className="text-sm font-medium mb-1 block">Geslo certifikata</label>
            <Input
              id="furs-cert-password"
              type="password"
              placeholder="••••••••"
              value={certPassword}
              onChange={e => onCertPasswordChange(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="furs-environment" className="text-sm font-medium mb-1 block">Okolje</label>
            <select
              id="furs-environment"
              value={environment}
              onChange={e => onEnvironmentChange(e.target.value as 'test' | 'production')}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            >
              <option value="test">Testno (blagajne-test.fu.gov.si)</option>
              <option value="production">Produkcijsko (blagajne.fu.gov.si)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onSave} disabled={!certPath || saving} className="gap-2">
            <Upload className="h-4 w-4" />
            {saving ? 'Shranjujem...' : 'Shrani certifikat'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})

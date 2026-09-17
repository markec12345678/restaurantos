'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TestTube2, AlertTriangle } from 'lucide-react'

// ============================================
// CIS CERTIFIKAT POLJA — FINA certifikat (Hrvaška)
// Modelirano na FursCertificateFields.tsx; P12 se pri CIS uporablja za
// XML-dsig podpis sporočil (ne na TLS nivoju, kot pri FURS).
// Pot do certifikata je maskirana ('••••••'), ko je nastavljen —
// zastavico hasCert posreduje forma (GET /api/settings → hasCisCert).
// ============================================
interface CisCertificateFieldsProps {
  certPath: string
  onCertPathChange: (_v: string) => void
  certPassword: string
  onCertPasswordChange: (_v: string) => void
  environment: string
  onEnvironmentChange: (_v: string) => void
  certificateFormat: string
  authorityShort: string
  hasCert?: boolean
}

export const CisCertificateFields = memo(function CisCertificateFields({
  certPath, onCertPathChange, certPassword, onCertPasswordChange,
  environment, onEnvironmentChange, certificateFormat, authorityShort, hasCert,
}: CisCertificateFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Pot do certifikata ({certificateFormat})</Label>
          <Input
            value={certPath}
            onChange={e => onCertPathChange(e.target.value)}
            placeholder="/pot/do/fina-certifikata.p12"
          />
          <p className="text-xs text-muted-foreground">
            FINA digitalni certifikat za XML-dsig podpis računov ({certificateFormat})
            {hasCert ? ' — nastavljen (prikazan maskiran)' : ''}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Geslo certifikata</Label>
          <Input
            type="password"
            value={certPassword}
            onChange={e => onCertPasswordChange(e.target.value)}
            placeholder="Geslo za FINA certifikat"
          />
          <p className="text-xs text-muted-foreground">Geslo za dostop do FINA certifikata</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Okolje {authorityShort}</Label>
        <Select value={environment} onValueChange={onEnvironmentChange}>
          <SelectTrigger className="w-64 min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="test">
              <span className="flex items-center gap-2">
                <TestTube2 className="h-3.5 w-3.5 text-blue-500" />
                Testno okolje (cistest.apis-it.hr)
              </span>
            </SelectItem>
            <SelectItem value="production">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Produkcijsko okolje (cis.porezna-uprava.hr)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )
})

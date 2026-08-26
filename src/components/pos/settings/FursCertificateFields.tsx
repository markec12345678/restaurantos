'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TestTube2, AlertTriangle } from 'lucide-react'

// ============================================
// FURS CERTIFIKAT POLJA — Podkomponenta
// ============================================
interface FursCertificateFieldsProps {
  certPath: string
  onCertPathChange: (_v: string) => void
  certPassword: string
  onCertPasswordChange: (_v: string) => void
  environment: string
  onEnvironmentChange: (_v: string) => void
  certificateFormat: string
  authorityShort: string
}

export const FursCertificateFields = memo(function FursCertificateFields({
  certPath, onCertPathChange, certPassword, onCertPasswordChange,
  environment, onEnvironmentChange, certificateFormat, authorityShort,
}: FursCertificateFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Pot do certifikata ({certificateFormat})</Label>
          <Input
            value={certPath}
            onChange={e => onCertPathChange(e.target.value)}
            placeholder="/pot/do/certifikata.p12"
          />
          <p className="text-xs text-muted-foreground">Digitalni certifikat za podpisovanje računov ({certificateFormat})</p>
        </div>
        <div className="space-y-2">
          <Label>Geslo certifikata</Label>
          <Input
            type="password"
            value={certPassword}
            onChange={e => onCertPasswordChange(e.target.value)}
            placeholder="Geslo za certifikat"
          />
          <p className="text-xs text-muted-foreground">Geslo za dostop do digitalnega certifikata</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Okolje {authorityShort}</Label>
        <Select value={environment} onValueChange={onEnvironmentChange}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="test">
              <span className="flex items-center gap-2">
                <TestTube2 className="h-3.5 w-3.5 text-blue-500" />
                Testno okolje
              </span>
            </SelectItem>
            <SelectItem value="production">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Produkcijsko okolje
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )
})

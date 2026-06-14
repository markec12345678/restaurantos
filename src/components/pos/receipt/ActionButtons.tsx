'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Copy, CheckCircle2, Shield, FileWarning, Mail, MessageSquare } from 'lucide-react'
import type { ActionButtonsProps } from './constants'

// ============================================
// AKCIJSKI GUMBI V GLAVI RAČUNA
// ============================================
export const ActionButtons = memo(function ActionButtons({
  isPreview,
  receipt,
  verifying,
  onConfirmAndPrint,
  onPrint,
  onCopy,
  onFiscalVerify,
  onStorno,
  onSendEmail,
  onSendSms,
}: ActionButtonsProps) {
  return (
    <div className="flex gap-1">
      {/* Predogled — potrdi in natisni */}
      {isPreview && receipt && (
        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={onConfirmAndPrint} autoFocus>
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Potrdi in natisni
        </Button>
      )}
      {/* Natisnjen račun — kopija, tisk, e-pošta, SMS */}
      {!isPreview && (
        <>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCopy} autoFocus>
            <Copy className="h-3 w-3 mr-1" />
            Kopija
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onPrint}>
            <Printer className="h-3 w-3 mr-1" />
            Natisni
          </Button>
          {/* Digitalni račun — pošlji po e-pošti */}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onSendEmail}>
            <Mail className="h-3 w-3 mr-1" />
            E-pošta
          </Button>
          {/* Digitalni račun — pošlji po SMS */}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onSendSms}>
            <MessageSquare className="h-3 w-3 mr-1" />
            SMS
          </Button>
        </>
      )}
      {/* FURS overitev gumb */}
      {receipt && !receipt.fiscalVerified && !isPreview && (
        <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={onFiscalVerify} disabled={verifying}>
          <Shield className="h-3 w-3 mr-1" />
          {verifying ? 'Overjam...' : 'Davčno overi'}
        </Button>
      )}
      {/* Storno gumb - odpre StornoDialog z razlogom */}
      {receipt && !receipt.isStorno && receipt.fiscalVerified && !isPreview && (
        <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onStorno}>
          <FileWarning className="h-3 w-3 mr-1" />
          STORNO
        </Button>
      )}
    </div>
  )
})

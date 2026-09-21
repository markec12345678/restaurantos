'use client'

import { memo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Link2 } from 'lucide-react'
import { copyToClipboard } from './copy-to-clipboard'

// ============================================
// WEBHOOK URL (R90) — izdajni URL za dostavne platforme
// GET /api/integrations vrača webhookUrl SAMO za dostavne integracije
// (wolt/glovo/bolt) z konfigurirano HMAC skrivnostjo — izostanek polja
// = "ni na voljo" (starš ne izriše sekcije). URL se nastavi v portalu
// dostavne platforme; rotacija skrivnosti na strežniku ga razveljavi.
// Hišni vzorec: location/OrderingLinkSection.tsx (R89-2) — readOnly
// font-mono Input + Kopiraj + sonner toast. R91-3: copy logika izvlečena
// v copy-to-clipboard.ts (deljena z webhook badge v IntegrationTable).
// ============================================

export const WebhookUrlSection = memo(function WebhookUrlSection({ webhookUrl }: { webhookUrl: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyToClipboard(webhookUrl)
    if (ok) {
      toast.success('URL kopiran')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Kopiranje ni uspelo — kopirajte URL ročno.')
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-semibold flex items-center gap-2">
        <Link2 className="h-4 w-4" /> Webhook URL
      </p>

      {/* URL + kopiranje — input se na mobilnem ne prelomi (horizontalni scroll znotraj inputa) */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <Input
          readOnly
          value={webhookUrl}
          onFocus={e => e.currentTarget.select()}
          aria-label="Webhook URL za dostavno platformo"
          className="font-mono text-xs"
        />
        <Button onClick={handleCopy} aria-label="Kopiraj webhook URL" className="h-11 gap-2">
          <Copy className="h-4 w-4" /> {copied ? 'Kopirano' : 'Kopiraj'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Konfiguriraj ta URL v portalu dostavne platforme (Wolt/Glovo/Bolt).
      </p>
      <p className="text-xs text-muted-foreground">
        Rotacija skrivnosti na strežniku razveljavi ta URL — po rotaciji nastavi novega.
      </p>
    </div>
  )
})

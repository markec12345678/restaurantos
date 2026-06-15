'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import type { ReceiptData } from './constants'

// ============================================
// HOOK ZA GENERIRANJE QR KODE (FURS)
// ============================================

export function useQrCode(receipt: ReceiptData | null | undefined) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')

  useEffect(() => {
    if (!receipt?.fiscalVerified || !receipt.zoi) {
      queueMicrotask(() => setQrCodeDataUrl(''))
      return
    }

    const generateQR = async () => {
      try {
        // FURS QR vsebina: ZOI | datum | znesek | davčna št. | prostor | blagajna
        const dt = new Date(receipt.receiptDate)
        const day = String(dt.getDate()).padStart(2, '0')
        const month = String(dt.getMonth() + 1).padStart(2, '0')
        const year = dt.getFullYear()
        const hours = String(dt.getHours()).padStart(2, '0')
        const minutes = String(dt.getMinutes()).padStart(2, '0')
        const seconds = String(dt.getSeconds()).padStart(2, '0')
        const formattedDate = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`

        // FIX MEDIUM: Only strip leading "SI" prefix (not "SI" elsewhere)
        const taxNumber = receipt.taxId.replace(/^SI/, '')
        const qrContent = [
          receipt.zoi,
          formattedDate,
          receipt.total.toFixed(2),
          taxNumber,
          receipt.businessId,
          receipt.registerId,
        ].join('|')

        const dataUrl = await QRCode.toDataURL(qrContent, {
          width: 120,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        })
        setQrCodeDataUrl(dataUrl)
      } catch {
        toast.error('Napaka pri generiranju QR kode')
        setQrCodeDataUrl('')
      }
    }

    generateQR()
  }, [receipt?.fiscalVerified, receipt?.zoi, receipt?.receiptDate, receipt?.total, receipt?.taxId, receipt?.businessId, receipt?.registerId])

  return qrCodeDataUrl
}

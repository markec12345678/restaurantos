// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Hook za nalaganje digitalnega računa
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import type { ReceiptData } from './types'

interface UseReceiptReturn {
  receipt: ReceiptData | null
  loading: boolean
  error: string
  copied: boolean
  copyZOI: () => void
}

export function useReceipt(receiptId: string | null): UseReceiptReturn {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!receiptId) {
      setError('Manjka ID računa')
      setLoading(false)
      return
    }
    fetchReceipt(receiptId)
  }, [receiptId])

  async function fetchReceipt(id: string) {
    try {
      const res = await fetch(`/api/digital-receipt?id=${encodeURIComponent(id)}`)
      if (!res.ok) {
        setError('Račun ni najden')
        return
      }
      const data = await res.json()
      setReceipt(data)
    } catch {
      setError('Napaka pri nalaganju računa')
    } finally {
      setLoading(false)
    }
  }

  const copyZOI = useCallback(() => {
    if (receipt?.zoi) {
      navigator.clipboard.writeText(receipt.zoi)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [receipt?.zoi])

  return { receipt, loading, error, copied, copyZOI }
}

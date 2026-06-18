'use client'

import { useEffect } from 'react'

// ─── Lightweight Client-Side Error Handler ────────────────────
// Captures unhandled errors and promise rejections.
// Sends to /api/monitoring/errors endpoint.
// Zero dependencies. Mount once in root layout.

export function ErrorHandler() {
  useEffect(() => {
    const sendError = async (data: {
      message: string
      stack?: string
      level?: string
      tags?: Record<string, string>
    }) => {
      try {
        await fetch('/api/monitoring/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          }),
        })
      } catch {
        // Silent fail — don't cause infinite error loop
      }
    }

    const handleError = (event: ErrorEvent) => {
      sendError({
        message: event.message || 'Unhandled error',
        stack: event.error?.stack,
        tags: { type: 'window.onerror', filename: event.filename, line: String(event.lineno) },
      })
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      sendError({
        message: reason?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection'),
        stack: reason?.stack,
        level: 'error',
        tags: { type: 'unhandledrejection' },
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}

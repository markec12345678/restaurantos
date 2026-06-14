'use client'

// ============================================
// ERROR BOUNDARY ZA RESTAURANTOS
// Izboljšan z omejitvijo ponovnih poskusov, boljšim UI-jem
// in povezavo na modulni kontekst POS sistema
// ============================================

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { logger } from '@/lib/logger'
import { queryClient } from '@/lib/query-client'

// ============================================
// TIPI
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode
  /** Custom fallback — če je podan, se uporabi namesto privzetega */
  fallback?: ReactNode
  /** Kontekst za logiranje (npr. 'POS:orders', 'KDS') */
  context?: string
  /** Callback ob napaki — uporabno za crash reporting */
  onError?: (_error: Error, _errorInfo: ErrorInfo) => void
  /** Maksimalno število ponovnih poskusov preden se trajno prikaže napaka (default: 3) */
  maxRetries?: number
  /** Ali naj počisti React Query cache ob ponastavitvi (default: true) */
  clearCacheOnReset?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  retryCount: number
  /** True, ko so vsi ponovni poskusi porabljeni */
  exhausted: boolean
}

// ============================================
// KONSTANTE
// ============================================

const DEFAULT_MAX_RETRIES = 3

// ============================================
// ERROR BOUNDARY KOMPONENTA
// ============================================

/**
 * React Error Boundary za ujetje napak v komponentah.
 *
 * Izboljšave nad osnovnim ErrorBoundary:
 * 1. Omejitev ponovnih poskusov — po maxRetries se prikaže trajna napaka
 * 2. Strukturirano logiranje s kontekstom
 * 3. Podpora za crash reporting callback (onError)
 * 4. Opcijsko brisanje React Query cache-a ob ponastavitvi
 * 5. Boljši privzeti UI z informacijo o številu poskusov
 * 6. Dva gumba: Ponovni poskus (brez čiščenja) in Ponastavitev (s čiščenjem cache-a)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0, exhausted: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Ne povečuj retryCount tukaj — to delamo v componentDidCatch,
    // kjer imamo dostop do this.props.maxRetries
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context = this.props.context || 'ErrorBoundary'
    const maxRetries = this.props.maxRetries ?? DEFAULT_MAX_RETRIES
    const newRetryCount = this.state.retryCount + 1
    const exhausted = newRetryCount >= maxRetries

    logger.error(context, 'Neulovljena napaka v komponenti', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: newRetryCount,
      maxRetries,
      exhausted,
    })

    // Posodobi stanje s pravilnim retryCount in exhausted
    this.setState({ retryCount: newRetryCount, exhausted })

    // Pokliči custom onError callback če je podan — uporabno za crash reporting
    this.props.onError?.(error, errorInfo)
  }

  private handleRetry = () => {
    // Ponovni poskus brez čiščenja cache-a — ohrani uporabnikove podatke
    this.setState({ hasError: false, error: null })
  }

  private handleReset = () => {
    const shouldClearCache = this.props.clearCacheOnReset ?? true
    // Počisti React Query cache pri ponastavitvi — pridobi sveže podatke
    if (shouldClearCache) {
      queryClient.clear()
    }
    // Ponastavi vse števce
    this.setState({ hasError: false, error: null, retryCount: 0, exhausted: false })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    // Custom fallback če je podan
    if (this.props.fallback) {
      return this.props.fallback
    }

    const maxRetries = this.props.maxRetries ?? DEFAULT_MAX_RETRIES
    const { retryCount, exhausted, error } = this.state
    const isDev = process.env.NODE_ENV === 'development'
    const contextLabel = this.props.context || 'Komponenta'

    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          padding: 24,
          maxWidth: 560,
          margin: '40px auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#fef2f2',
          borderRadius: 12,
          border: '1px solid #fecaca',
          textAlign: 'center',
        }}
      >
        {/* Ikona napake */}
        <div style={{ fontSize: 36, marginBottom: 8, lineHeight: 1 }} aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Naslov */}
        <h3 style={{ color: '#dc2626', margin: '0 0 8px 0', fontSize: 18 }}>
          Napaka v {contextLabel}
        </h3>

        {/* Opis napake */}
        <p style={{ color: '#7f1d1d', margin: '0 0 6px 0', fontSize: 14 }}>
          Prišlo je do nepričakovane napake. Poskusite znova ali ponastavite modul.
        </p>

        {/* Informacija o poskusih */}
        {retryCount > 1 && (
          <p style={{ color: '#991b1b', margin: '0 0 16px 0', fontSize: 13, opacity: 0.8 }}>
            Ponovni poskus {retryCount}/{maxRetries}
            {exhausted && ' — doseženih maksimalnih poskusov'}
          </p>
        )}

        {/* Podrobnosti napake samo v development načinu */}
        {isDev && error && (
          <pre
            style={{
              background: '#fff',
              padding: 12,
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 11,
              textAlign: 'left',
              margin: '0 0 16px 0',
              maxHeight: 120,
              border: '1px solid #e5e7eb',
              color: '#374151',
            }}
          >
            {error.message}
          </pre>
        )}

        {/* Gumbi za dejanje */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!exhausted && (
            <button
              onClick={this.handleRetry}
              style={{
                padding: '8px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Poskusi znova
            </button>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 20px',
              background: exhausted ? '#dc2626' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Ponastavi modul
          </button>
        </div>
      </div>
    )
  }
}

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { logger } from '@/lib/logger'
import { queryClient } from '@/lib/query-client'
import { ErrorFallback } from './ErrorFallback'

// ============================================
// TIPI
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  context?: string
  onError?: (_error: Error, _errorInfo: ErrorInfo) => void
  maxRetries?: number
  clearCacheOnReset?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  retryCount: number
  exhausted: boolean
}

const DEFAULT_MAX_RETRIES = 3

// ============================================
// ERROR BOUNDARY KOMPONENTA
// ============================================
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0, exhausted: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
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

    this.setState({ retryCount: newRetryCount, exhausted })
    this.props.onError?.(error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleReset = () => {
    const shouldClearCache = this.props.clearCacheOnReset ?? true
    if (shouldClearCache) {
      queryClient.clear()
    }
    this.setState({ hasError: false, error: null, retryCount: 0, exhausted: false })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    const maxRetries = this.props.maxRetries ?? DEFAULT_MAX_RETRIES
    const { retryCount, exhausted, error } = this.state
    const contextLabel = this.props.context || 'Komponenta'

    return (
      <ErrorFallback
        error={error}
        retryCount={retryCount}
        maxRetries={maxRetries}
        exhausted={exhausted}
        contextLabel={contextLabel}
        onRetry={this.handleRetry}
        onReset={this.handleReset}
      />
    )
  }
}

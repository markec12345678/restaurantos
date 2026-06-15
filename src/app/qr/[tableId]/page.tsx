'use client'

import dynamic from 'next/dynamic'
import { useQROrdering } from './hooks/use-qr-ordering'

// ============================================
// LAZY LOADING — Vse pod-komponente nalagamo lenobo
// ssr: false — vse komponente so 'use client' z brskalniškimi API-ji
// ============================================
const LoadingState = dynamic(() => import('./components/LoadingState').then(m => ({ default: m.LoadingState })), { ssr: false })
const TableNotFound = dynamic(() => import('./components/TableNotFound').then(m => ({ default: m.TableNotFound })), { ssr: false })
const OrderSuccess = dynamic(() => import('./components/OrderSuccess').then(m => ({ default: m.OrderSuccess })), { ssr: false })
const QRMenuContent = dynamic(() => import('./QRMenuContent').then(m => ({ default: m.QRMenuContent })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export default function QROrderingPage({ params }: { params: Promise<{ tableId: string }> }) {
  const state = useQROrdering(params)

  // ============================================
  // LOADING STATE
  // ============================================
  if (state.loading) {
    return <LoadingState t={state.t} />
  }

  // ============================================
  // TABLE NOT FOUND
  // ============================================
  if (state.tableNotFound) {
    return <TableNotFound t={state.t} />
  }

  // ============================================
  // ORDER SUCCESS + TRACKING
  // ============================================
  if (state.orderResult) {
    return (
      <OrderSuccess
        t={state.t}
        orderResult={state.orderResult}
        orderStatus={state.orderStatus}
        onNewOrder={state.dismissOrderResult}
      />
    )
  }

  // ============================================
  // MAIN MENU UI
  // ============================================
  return <QRMenuContent state={state} />
}

'use client'

import dynamic from 'next/dynamic'

// =====================================================================
// Barrel — lenobo naložene podkomponente za checkout
// =====================================================================

const DetailsStep = dynamic(() => import('./DetailsStep').then(m => ({ default: m.DetailsStep })), { ssr: false })
const PaymentStep = dynamic(() => import('./PaymentStep').then(m => ({ default: m.PaymentStep })), { ssr: false })
const ConfirmationView = dynamic(() => import('./ConfirmationView').then(m => ({ default: m.ConfirmationView })), { ssr: false })
const ItemDetailModal = dynamic(() => import('./ItemDetailModal').then(m => ({ default: m.ItemDetailModal })), { ssr: false })

export { DetailsStep, PaymentStep, ConfirmationView, ItemDetailModal }

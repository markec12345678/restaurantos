'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/register-sw'

/**
 * Client-side komponenta za registracijo Service Workerja
 * Nameščena v layout.tsx kot <RegisterSW />
 */
export function RegisterSW() {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return null
}

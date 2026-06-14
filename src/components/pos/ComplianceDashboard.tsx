'use client'

import { Button } from '@/components/ui/button'
import { Shield, RefreshCw } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useComplianceData } from './compliance/useComplianceData'

// Lazy-loaded pod-komponente
const ComplianceSummaryCards = dynamic(() => import('./compliance/ComplianceSummaryCards').then(m => ({ default: m.ComplianceSummaryCards })), { ssr: false })
const ComplianceTabs = dynamic(() => import('./compliance/ComplianceTabs').then(m => ({ default: m.ComplianceTabs })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA SKLADNOSTI S PREDPISI
// ============================================
export const ComplianceDashboard = memo(function ComplianceDashboard() {
  const {
    items,
    loadCompliance,
    compliantCount,
    warningCount,
    nonCompliantCount,
    pendingCount,
    complianceScore,
  } = useComplianceData()

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Skladnost s predpisi</h2>
            <p className="text-sm text-muted-foreground">EU predpisi, GDPR, FURS, HACCP, delovno pravo</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={loadCompliance}>
          <RefreshCw className="h-3 w-3 mr-1" /> Preveri
        </Button>
      </div>

      {/* Povzetek */}
      <ComplianceSummaryCards
        complianceScore={complianceScore}
        compliantCount={compliantCount}
        warningCount={warningCount}
        nonCompliantCount={nonCompliantCount}
        pendingCount={pendingCount}
      />

      {/* Skladnost po kategorijah */}
      <ComplianceTabs items={items} />
    </div>
  )
})

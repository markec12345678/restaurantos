'use client'

import { usePOSStore } from '@/lib/store'
import { Sidebar } from '@/components/pos/Sidebar'
import { Dashboard } from '@/components/pos/Dashboard'
import { OrderPanel } from '@/components/pos/OrderPanel'
import { TableMap } from '@/components/pos/TableMap'
import { MenuManager } from '@/components/pos/MenuManager'
import { InventoryManager } from '@/components/pos/InventoryManager'
import { EmployeeManager } from '@/components/pos/EmployeeManager'
import { ReportsView } from '@/components/pos/ReportsView'
import { motion, AnimatePresence } from 'framer-motion'

const moduleComponents: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  orders: OrderPanel,
  tables: TableMap,
  menu: MenuManager,
  inventory: InventoryManager,
  employees: EmployeeManager,
  reports: ReportsView,
}

export default function POSPage() {
  const { activeModule } = usePOSStore()
  const ActiveComponent = moduleComponents[activeModule] || Dashboard

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeModule}
            className="h-full"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

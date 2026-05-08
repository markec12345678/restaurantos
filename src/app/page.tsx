'use client'

import { usePOSStore } from '@/lib/store'
import { Sidebar } from '@/components/pos/Sidebar'
import { KioskBar } from '@/components/pos/KioskBar'
import { Dashboard } from '@/components/pos/Dashboard'
import { OrderPanel } from '@/components/pos/OrderPanel'
import { KitchenDisplay } from '@/components/pos/KitchenDisplay'
import { TableMap } from '@/components/pos/TableMap'
import { MenuManager } from '@/components/pos/MenuManager'
import { InventoryManager } from '@/components/pos/InventoryManager'
import { EmployeeManager } from '@/components/pos/EmployeeManager'
import { CashRegister } from '@/components/pos/CashRegister'
import { ReportsView } from '@/components/pos/ReportsView'
import { HaccpManager } from '@/components/pos/HaccpManager'
import { RecipeManager } from '@/components/pos/RecipeManager'
import { SettingsManager } from '@/components/pos/SettingsManager'
import { ConfigurationManager } from '@/components/pos/ConfigurationManager'
import { DeliveryManager } from '@/components/pos/DeliveryManager'
import { GiftCardManager } from '@/components/pos/GiftCardManager'
import { LoyaltyManager } from '@/components/pos/LoyaltyManager'
import { PrinterManager } from '@/components/pos/PrinterManager'
import { WebhookManager } from '@/components/pos/WebhookManager'
import { ShiftManager } from '@/components/pos/ShiftManager'
import { GlobalNotifications } from '@/components/pos/GlobalNotifications'
import { PinLogin, getCurrentUser, setCurrentUser } from '@/components/pos/PinLogin'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

const moduleComponents: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  orders: OrderPanel,
  kitchen: KitchenDisplay,
  tables: TableMap,
  'cash-register': CashRegister,
  menu: MenuManager,
  inventory: InventoryManager,
  recipes: RecipeManager,
  haccp: HaccpManager,
  employees: EmployeeManager,
  reports: ReportsView,
  configuration: ConfigurationManager,
  delivery: DeliveryManager,
  'gift-cards': GiftCardManager,
  loyalty: LoyaltyManager,
  printers: PrinterManager,
  webhooks: WebhookManager,
  shifts: ShiftManager,
  settings: SettingsManager,
}

export default function POSPage() {
  const { activeModule, kioskMode } = usePOSStore()
  const ActiveComponent = moduleComponents[activeModule] || OrderPanel
  const [authUser, setAuthUser] = useState<ReturnType<typeof getCurrentUser>>(null)

  useEffect(() => {
    const stored = getCurrentUser()
    if (stored) setAuthUser(stored)
  }, [])

  if (!authUser) {
    return (
      <div className="h-screen bg-background">
        <PinLogin
          onLogin={(user) => { setAuthUser(user); setCurrentUser(user) }}
          onSkip={() => {
            setCurrentUser({ id: 'guest', name: 'Gost', email: '', role: 'admin', primaryJob: null, permissions: ['admin'] })
            setAuthUser({ id: 'guest', name: 'Gost', email: '', role: 'admin', primaryJob: null, permissions: ['admin'] })
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Kiosk način: KioskBar namesto Sidebar */}
      {kioskMode ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <KioskBar />
          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="h-full"
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      ) : (
        <>
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="h-full"
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </main>
        </>
      )}
      <GlobalNotifications />
    </div>
  )
}

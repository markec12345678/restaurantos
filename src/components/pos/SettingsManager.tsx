'use client'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Settings, Building2, Shield, Receipt, Percent, Globe,
  Sparkles, Plug, Mail, MonitorSmartphone,
  Save,
} from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useSettingsManager } from './settings/useSettingsManager'

// Lazy-loaded podkomponente
const CountryTab = dynamic(() => import('./settings/CountryTab').then(m => ({ default: m.CountryTab })), { ssr: false })
const CompanyTab = dynamic(() => import('./settings/CompanyTab').then(m => ({ default: m.CompanyTab })), { ssr: false })
const TaxTab = dynamic(() => import('./settings/TaxTab').then(m => ({ default: m.TaxTab })), { ssr: false })
const FursTab = dynamic(() => import('./settings/FursTab').then(m => ({ default: m.FursTab })), { ssr: false })
const CisTab = dynamic(() => import('./settings/CisTab').then(m => ({ default: m.CisTab })), { ssr: false })
const ReceiptTab = dynamic(() => import('./settings/ReceiptTab').then(m => ({ default: m.ReceiptTab })), { ssr: false })
const AiTab = dynamic(() => import('./settings/AiTab').then(m => ({ default: m.AiTab })), { ssr: false })
const IntegrationsTab = dynamic(() => import('./settings/IntegrationsTab').then(m => ({ default: m.IntegrationsTab })), { ssr: false })
const EmailTab = dynamic(() => import('./settings/EmailTab').then(m => ({ default: m.EmailTab })), { ssr: false })
const DeviceTab = dynamic(() => import('./settings/DeviceTab').then(m => ({ default: m.DeviceTab })), { ssr: false })
const SettingsStatusBar = dynamic(() => import('./settings/SettingsStatusBar').then(m => ({ default: m.SettingsStatusBar })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export const SettingsManager = memo(function SettingsManager() {
  const {
    activeTab, setActiveTab,
    fursStatus,
    cisStatus,
    lastSaved,
    selectedCountry,
    bulkVatFrom, setBulkVatFrom,
    bulkVatTo, setBulkVatTo,
    form,
    currentCountryConfig,
    isLoading,
    saveMutation,
    bulkVatMutation,
    handleCountryChange,
    handleSave,
    handleBulkVatChange,
    testFursConnection,
    testCisConnection,
    cisSendStatus,
    cisSendResult,
    sendCisTestInvoice,
    updateField,
  } = useSettingsManager()

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Nastavitve
          </h2>
          <p className="text-muted-foreground">Konfiguracija sistema, davčne nastavitve in FURS povezava</p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="min-w-32">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Shranjujem...' : 'Shrani'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="country" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Država
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Podjetje
          </TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5">
            <Percent className="h-3.5 w-3.5" /> Davki
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> {currentCountryConfig.fiscalization.authorityShort}
          </TabsTrigger>
          <TabsTrigger value="receipt" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Račun
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> AI
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5">
            <Plug className="h-3.5 w-3.5" /> Integracije
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email
          </TabsTrigger>
          <TabsTrigger value="device" className="gap-1.5">
            <MonitorSmartphone className="h-3.5 w-3.5" /> Naprava
          </TabsTrigger>
        </TabsList>

        {/* TAB: DRŽAVA / REGIJA */}
        <TabsContent value="country" className="space-y-4 mt-4">
          <CountryTab
            selectedCountry={selectedCountry}
            onCountryChange={handleCountryChange}
          />
        </TabsContent>

        {/* TAB: PODATKI PODJETJA */}
        <TabsContent value="company" className="space-y-4 mt-4">
          <CompanyTab
            form={form}
            updateField={updateField}
          />
        </TabsContent>

        {/* TAB: DAVČNE NASTAVITVE */}
        <TabsContent value="tax" className="space-y-4 mt-4">
          <TaxTab
            form={form}
            updateField={updateField}
            currentCountryCode={selectedCountry}
            bulkVatFrom={bulkVatFrom}
            bulkVatTo={bulkVatTo}
            setBulkVatFrom={setBulkVatFrom}
            setBulkVatTo={setBulkVatTo}
            onBulkVatChange={handleBulkVatChange}
            bulkVatPending={bulkVatMutation.isPending}
          />
        </TabsContent>

        {/* TAB: FISKALIZACIJA — FURS (SI) oz. CIS (HR, Task 24-c) */}
        <TabsContent value="fiscal" className="space-y-4 mt-4">
          {selectedCountry === 'HR' ? (
            <CisTab
              form={form}
              updateField={updateField}
              cisStatus={cisStatus}
              onTestCisConnection={testCisConnection}
              cisSendStatus={cisSendStatus}
              cisSendResult={cisSendResult}
              onSendCisTestInvoice={sendCisTestInvoice}
              currentCountryCode={selectedCountry}
            />
          ) : (
            <FursTab
              form={form}
              updateField={updateField}
              fursStatus={fursStatus}
              onTestFursConnection={testFursConnection}
              currentCountryCode={selectedCountry}
            />
          )}
        </TabsContent>

        {/* TAB: NOGA RAČUNA */}
        <TabsContent value="receipt" className="space-y-4 mt-4">
          <ReceiptTab
            form={form}
            updateField={updateField}
          />
        </TabsContent>

        {/* TAB: AI NASTAVITVE */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <AiTab
            form={form}
            updateField={updateField}
          />
        </TabsContent>

        {/* TAB: INTEGRACIJE */}
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <IntegrationsTab
            form={form}
            updateField={updateField}
          />
        </TabsContent>

        {/* TAB: EMAIL / SMTP */}
        <TabsContent value="email" className="space-y-4 mt-4">
          <EmailTab
            form={form}
            updateField={updateField}
          />
        </TabsContent>

        {/* TAB: NAPRAVA — binding lokacije trenutne naprave (R96-b, dvostopenjska prijava) */}
        <TabsContent value="device" className="space-y-4 mt-4">
          <DeviceTab />
        </TabsContent>
      </Tabs>

      {/* Status bar */}
      <SettingsStatusBar
        form={form}
        fursStatus={fursStatus}
        cisStatus={cisStatus}
        lastSaved={lastSaved}
        currentCountryCode={selectedCountry}
      />
    </div>
  )
})

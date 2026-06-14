'use client'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Settings, Building2, Shield, Receipt, Percent, Globe,
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
const ReceiptTab = dynamic(() => import('./settings/ReceiptTab').then(m => ({ default: m.ReceiptTab })), { ssr: false })
const SettingsStatusBar = dynamic(() => import('./settings/SettingsStatusBar').then(m => ({ default: m.SettingsStatusBar })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export const SettingsManager = memo(function SettingsManager() {
  const {
    activeTab, setActiveTab,
    fursStatus,
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="country" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Država
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Podjetje
          </TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5">
            <Percent className="h-3.5 w-3.5" /> Davki
          </TabsTrigger>
          <TabsTrigger value="furs" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> {currentCountryConfig.fiscalization.authorityShort}
          </TabsTrigger>
          <TabsTrigger value="receipt" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Račun
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

        {/* TAB: FISKALIZACIJA */}
        <TabsContent value="furs" className="space-y-4 mt-4">
          <FursTab
            form={form}
            updateField={updateField}
            fursStatus={fursStatus}
            onTestFursConnection={testFursConnection}
            currentCountryCode={selectedCountry}
          />
        </TabsContent>

        {/* TAB: NOGA RAČUNA */}
        <TabsContent value="receipt" className="space-y-4 mt-4">
          <ReceiptTab
            form={form}
            updateField={updateField}
          />
        </TabsContent>
      </Tabs>

      {/* Status bar */}
      <SettingsStatusBar
        form={form}
        fursStatus={fursStatus}
        lastSaved={lastSaved}
        currentCountryCode={selectedCountry}
      />
    </div>
  )
})

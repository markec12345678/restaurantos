'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { UserCircle } from 'lucide-react'
import type { GuestProfile as GuestProfileType } from './constants'

// --- Lenično naložene podkomponente ---

const VisitTimeline = dynamic(
  () => import('./VisitTimeline').then(m => m.VisitTimeline),
  { ssr: false }
)

const GuestProfileTab = dynamic(
  () => import('./GuestProfileTab').then(m => m.GuestProfileTab),
  { ssr: false }
)

const GuestPreferencesTab = dynamic(
  () => import('./GuestPreferencesTab').then(m => m.GuestPreferencesTab),
  { ssr: false }
)

// --- Props ---

interface GuestDetailProps {
  guest: GuestProfileType | null
}

// --- Komponenta: Podrobnosti gosa z zavihki ---

export const GuestDetail = memo(function GuestDetail({
  guest,
}: GuestDetailProps) {
  if (!guest) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="p-8 text-center">
          <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">Izberite gosta</p>
          <p className="text-sm text-muted-foreground">Kliknite na gosta na levi za pregled časovnice</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="timeline" className="h-full">
      <TabsList>
        <TabsTrigger value="timeline">Časovnica</TabsTrigger>
        <TabsTrigger value="profile">Profil</TabsTrigger>
        <TabsTrigger value="preferences">Preference</TabsTrigger>
      </TabsList>

      <TabsContent value="timeline" className="mt-3 space-y-3 overflow-auto max-h-[calc(100%-50px)]">
        <VisitTimeline visits={guest.visits} />
      </TabsContent>

      <TabsContent value="profile" className="mt-3 space-y-3 overflow-auto max-h-[calc(100%-50px)]">
        <GuestProfileTab guest={guest} />
      </TabsContent>

      <TabsContent value="preferences" className="mt-3 space-y-3 overflow-auto max-h-[calc(100%-50px)]">
        <GuestPreferencesTab guest={guest} />
      </TabsContent>
    </Tabs>
  )
})

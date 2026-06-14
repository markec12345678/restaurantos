'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Upravitelj obvestil
// Toast POS + SevenRooms standard
// SMS/Email/Push obvestila za rezervacije, naročila, dostave
// ═══════════════════════════════════════════════════════════════
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Bell, Plus, RefreshCw } from 'lucide-react'
import { useState, useCallback, memo } from 'react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import type { SendFormState } from './notification/constants'
import { defaultSendForm } from './notification/constants'

// Lazy-loaded podkomponente
const NotificationStatsCards = dynamic(() => import('./notification/NotificationStatsCards').then(m => ({ default: m.NotificationStatsCards })), { ssr: false })
const NotificationTemplates = dynamic(() => import('./notification/NotificationTemplates').then(m => ({ default: m.NotificationTemplates })), { ssr: false })
const NotificationHistory = dynamic(() => import('./notification/NotificationHistory').then(m => ({ default: m.NotificationHistory })), { ssr: false })
const NotificationSendDialog = dynamic(() => import('./notification/NotificationSendDialog').then(m => ({ default: m.NotificationSendDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA UPRAVITELJA OBVESTIL
// ============================================
export const NotificationManager = memo(function NotificationManager() {
  const queryClient = useQueryClient()
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [sendForm, setSendForm] = useState<SendFormState>({ ...defaultSendForm })

  const { data, isLoading, refetch } = useQuery<{
    notifications: import('./notification/constants').NotificationItem[]
    stats: import('./notification/constants').NotificationStats
  }>({
    queryKey: queryKeys.notifications.all,
    queryFn: async () => {
      const res = await authFetch('/api/notifications')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const sendMutation = useMutation({
    mutationFn: async (form: SendFormState) => {
      const res = await authFetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: (responseData) => {
      if (responseData.success) {
        toast.success('Obvestilo uspešno poslano')
      } else {
        toast.error('Pošiljanje ni uspelo')
      }
      setShowSendDialog(false)
      setSendForm({ ...defaultSendForm })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
    onError: () => {
      toast.error('Napaka pri pošiljanju obvestila')
    },
  })

  const handleUseTemplate = useCallback((form: SendFormState) => {
    setSendForm(form)
    setShowSendDialog(true)
  }, [])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setShowSendDialog(open)
  }, [])

  const handleSend = useCallback(() => {
    sendMutation.mutate(sendForm)
  }, [sendForm, sendMutation])

  const stats = data?.stats
  const notifications = data?.notifications || []

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Upravitelj obvestil
          </h2>
          <p className="text-sm text-muted-foreground">SMS, e-pošta in push obvestila za stranke in osebje</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
            <RefreshCw className="h-3 w-3" /> Osveži
          </Button>
          <Button size="sm" onClick={() => setShowSendDialog(true)} className="gap-1">
            <Plus className="h-3 w-3" /> Novo obvestilo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <NotificationStatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Predloge obvestil */}
        <NotificationTemplates onUseTemplate={handleUseTemplate} />

        {/* Zgodovina obvestil */}
        <NotificationHistory notifications={notifications} />
      </div>

      {/* Send Dialog */}
      <NotificationSendDialog
        open={showSendDialog}
        sendForm={sendForm}
        isPending={sendMutation.isPending}
        onOpenChange={handleDialogOpenChange}
        onFormChange={setSendForm}
        onSend={handleSend}
      />
    </div>
  )
})

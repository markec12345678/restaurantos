'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Upravitelj obvestil
// Toast POS + SevenRooms standard
// SMS/Email/Push obvestila za rezervacije, naročila, dostave
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Bell, Mail, Phone, Send, CheckCircle2, XCircle,
  Clock, Users, MessageSquare, Calendar, Truck,
  AlertTriangle, Plus, RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface NotificationItem {
  id: string
  action: string
  entityType: string
  details: Record<string, unknown>
  timestamp: string | Date
}

interface NotificationStats {
  totalSent: number
  totalFailed: number
  byType: { sms: number; email: number; push: number }
}

export function NotificationManager() {
  const queryClient = useQueryClient()
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [sendForm, setSendForm] = useState({
    channel: 'sms',
    recipient: '',
    subject: '',
    message: '',
  })

  const { data, isLoading, refetch } = useQuery<{
    notifications: NotificationItem[]
    stats: NotificationStats
  }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await authFetch('/api/notifications')
      return res.json()
    },
  })

  const sendMutation = useMutation({
    mutationFn: async (form: typeof sendForm) => {
      const res = await authFetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Obvestilo uspešno poslano')
      } else {
        toast.error('Pošiljanje ni uspelo')
      }
      setShowSendDialog(false)
      setSendForm({ channel: 'sms', recipient: '', subject: '', message: '' })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => {
      toast.error('Napaka pri pošiljanju obvestila')
    },
  })

  const stats = data?.stats
  const notifications = data?.notifications || []

  const channelIcons: Record<string, typeof Phone> = { sms: Phone, email: Mail, push: Bell }
  const channelLabels: Record<string, string> = { sms: 'SMS', email: 'E-pošta', push: 'Push' }
  const actionLabels: Record<string, string> = {
    NOTIFICATION_SENT: 'Poslano',
    NOTIFICATION_FAILED: 'Neuspešno',
    NOTIFICATION_QUEUED: 'V čakalni vrsti',
  }

  // Predloge obvestil
  const templates = [
    {
      name: 'Potrditev rezervacije',
      channel: 'sms',
      subject: '',
      message: 'Pozdravljeni! Vaša rezervacija je potrjena za {datum} ob {ura}. Lepo vabljeni! - {restavracija}',
    },
    {
      name: 'Naročilo v pripravi',
      channel: 'sms',
      subject: '',
      message: 'Vaše naročilo #{stevilka} je v pripravi. Predviden čas: {cas} min. - {restavracija}',
    },
    {
      name: 'Dostava na poti',
      channel: 'sms',
      subject: '',
      message: 'Vaše naročilo je na poti! Pričakujte dostavo v {cas} minutah. - {restavracija}',
    },
    {
      name: 'Opomnik rezervacije',
      channel: 'email',
      subject: 'Opomnik: Vaša rezervacija {datum}',
      message: 'Pozdravljeni! Opominjamo vas na rezervacijo za {datum} ob {ura} za {osebe} oseb. Lepo vabljeni!',
    },
    {
      name: 'Hvala za obisk',
      channel: 'email',
      subject: 'Hvala za vaš obisk!',
      message: 'Zahvaljujemo se vam za obisk! Upamo, da ste uživali. Vaše mnenje je pomembno: {povezava}',
    },
    {
      name: 'Promocija / Ponudba',
      channel: 'sms',
      subject: '',
      message: 'Samo danes! {ponudba}. Uporabite kodo {koda} za popust. - {restavracija}',
    },
  ]

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-xs text-muted-foreground">Poslana danes</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalSent || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <span className="text-xs text-muted-foreground">Neuspešna</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalFailed || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Phone className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs text-muted-foreground">SMS</span>
            </div>
            <p className="text-2xl font-bold">{stats?.byType?.sms || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Mail className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-xs text-muted-foreground">E-pošta</span>
            </div>
            <p className="text-2xl font-bold">{stats?.byType?.email || 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Predloge obvestil */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Predloge obvestil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates.map((tpl, idx) => {
                const ChannelIcon = channelIcons[tpl.channel] || Bell
                return (
                  <button
                    key={idx}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSendForm({
                        channel: tpl.channel,
                        recipient: '',
                        subject: tpl.subject,
                        message: tpl.message,
                      })
                      setShowSendDialog(true)
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{tpl.name}</span>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <ChannelIcon className="h-3 w-3" />
                        {channelLabels[tpl.channel]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{tpl.message}</p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Zgodovina obvestil */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Zadnja obvestila
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Ni poslanih obvestil</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {notifications.map((notif) => {
                  const details = typeof notif.details === 'string' ? JSON.parse(notif.details) : (notif.details as Record<string, unknown> || {})
                  const channel = (details?.channel as string) || 'unknown'
                  const recipient = (details?.recipient as string) || ''
                  const success = notif.action === 'NOTIFICATION_SENT'
                  const ChannelIcon = channelIcons[channel] || Bell

                  return (
                    <div key={notif.id} className={`p-2.5 rounded-lg border ${success ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">{recipient}</span>
                          <Badge variant="outline" className="text-[9px]">{channelLabels[channel] || channel}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {success ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(notif.timestamp), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                      {details?.subject && (
                        <p className="text-xs font-medium mt-1">{details.subject as string}</p>
                      )}
                      {details?.message && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{details.message as string}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Novo obvestilo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Kanal</label>
              <Select value={sendForm.channel} onValueChange={(v) => setSendForm({ ...sendForm, channel: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">E-pošta</SelectItem>
                  <SelectItem value="push">Push obvestilo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                {sendForm.channel === 'email' ? 'E-pošta' : 'Telefonska številka'}
              </label>
              <Input
                value={sendForm.recipient}
                onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}
                placeholder={sendForm.channel === 'email' ? 'email@primer.si' : '+386 1 234 5678'}
              />
            </div>
            {sendForm.channel === 'email' && (
              <div>
                <label className="text-sm font-medium mb-1 block">Zadeva</label>
                <Input
                  value={sendForm.subject}
                  onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
                  placeholder="Zadeva e-pošte"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Sporočilo</label>
              <Textarea
                value={sendForm.message}
                onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                placeholder="Vnesite sporočilo..."
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {'Uporabite {datum}, {ura}, {osebe}, {stevilka}, {restavracija} za dinamične vrednosti'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Prekliči</Button>
            <Button
              onClick={() => sendMutation.mutate(sendForm)}
              disabled={!sendForm.recipient || !sendForm.message || sendMutation.isPending}
              className="gap-1"
            >
              <Send className="h-3 w-3" />
              Pošlji
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

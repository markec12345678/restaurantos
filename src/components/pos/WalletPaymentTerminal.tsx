'use client'

// ============================================
// WALLET PAYMENT TERMINAL — POS Tap-to-Pay UI
// ============================================
// Prikazuje trenutna wallet plačila (Apple Pay, Google Pay, NFC)
// in omogoča operaterju:
//   - Spremljanje pending plačil v realnem času
//   - Capture (realizacija) authorized plačil
//   - Refund (povračilo) captured plačil
//   - Pregled zgodovine in statistike
// ============================================

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CreditCard, Smartphone, Nfc, Loader2, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, DollarSign, TrendingUp,
} from 'lucide-react'
import { format } from 'date-fns'

// --- Tipi ---
interface WalletPayment {
  id: string
  walletType: string // apple_pay, google_pay, samsung_pay, nfc_card, qr_pay
  amount: number
  currency: string
  status: string // pending, authorized, captured, failed, refunded
  transactionId: string
  cardBrand: string
  cardLast4: string
  capturedAt: string | null
  refundedAmount: number
  createdAt: string
}

interface WalletStats {
  totalPayments: number
  totalAmount: number
  totalRefunded: number
  byWallet: Array<{ walletType: string; count: number; amount: number }>
  byStatus: Array<{ status: string; count: number; amount: number }>
}

// --- Wallet config ---
const walletConfig: Record<string, { icon: typeof Smartphone; color: string; label: string }> = {
  apple_pay: { icon: Smartphone, color: 'bg-black text-white', label: 'Apple Pay' },
  google_pay: { icon: Smartphone, color: 'bg-blue-600 text-white', label: 'Google Pay' },
  samsung_pay: { icon: Smartphone, color: 'bg-purple-600 text-white', label: 'Samsung Pay' },
  nfc_card: { icon: Nfc, color: 'bg-green-600 text-white', label: 'NFC Kartica' },
  qr_pay: { icon: CreditCard, color: 'bg-orange-600 text-white', label: 'QR Pay' },
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Loader2, label: 'V obdelavi' },
  authorized: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: CheckCircle2, label: 'Avtorizirano' },
  captured: { color: 'bg-green-100 text-green-800 border-green-300', icon: DollarSign, label: 'Realizirano' },
  failed: { color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle, label: 'Neuspešno' },
  refunded: { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: RefreshCw, label: 'Povrnjeno' },
}

// --- Komponenta ---
export function WalletPaymentTerminal() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [captureDialog, setCaptureDialog] = useState<{ id: string; amount: number } | null>(null)
  const [refundDialog, setRefundDialog] = useState<{ id: string; maxAmount: number } | null>(null)
  const [refundAmount, setRefundAmount] = useState<string>('')

  // Fetch payments
  const { data: paymentsData, isLoading } = useQuery<{ payments: WalletPayment[]; count: number }>({
    queryKey: ['wallet-payments', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/wallet-payment${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    refetchInterval: 10_000,
  })

  // Fetch stats
  const { data: statsData } = useQuery<{ stats: WalletStats }>({
    queryKey: ['wallet-stats'],
    queryFn: async () => {
      const res = await fetch('/api/wallet-payment?stats=1')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    refetchInterval: 30_000,
  })

  // Capture mutation
  const captureMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wallet-payment/${id}/capture`, { method: 'POST' })
      if (!res.ok) throw new Error('Capture failed')
      return res.json()
    },
    onSuccess: () => {
      setCaptureDialog(null)
      queryClient.invalidateQueries({ queryKey: ['wallet-payments'] })
      queryClient.invalidateQueries({ queryKey: ['wallet-stats'] })
    },
  })

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await fetch(`/api/wallet-payment/${id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      if (!res.ok) throw new Error('Refund failed')
      return res.json()
    },
    onSuccess: () => {
      setRefundDialog(null)
      setRefundAmount('')
      queryClient.invalidateQueries({ queryKey: ['wallet-payments'] })
      queryClient.invalidateQueries({ queryKey: ['wallet-stats'] })
    },
  })

  const stats = statsData?.stats
  const payments = paymentsData?.payments || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Nfc className="h-6 w-6 text-primary" />
            Wallet Payment Terminal
          </h2>
          <p className="text-sm text-muted-foreground">
            Apple Pay · Google Pay · Samsung Pay · NFC · QR — PCI DSS 4.0.1
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          title="Skupaj plačil"
          value={stats?.totalPayments || 0}
          icon={CreditCard}
          color="bg-blue-50 border-blue-200 text-blue-800"
        />
        <StatCard
          title="Skupni znesek"
          value={`€${(stats?.totalAmount || 0).toFixed(2)}`}
          icon={TrendingUp}
          color="bg-green-50 border-green-200 text-green-800"
        />
        <StatCard
          title="Povrnjeno"
          value={`€${(stats?.totalRefunded || 0).toFixed(2)}`}
          icon={RefreshCw}
          color="bg-orange-50 border-orange-200 text-orange-800"
        />
        <StatCard
          title="Aktivni tipi"
          value={stats?.byWallet?.length || 0}
          icon={Smartphone}
          color="bg-purple-50 border-purple-200 text-purple-800"
        />
      </div>

      {/* Wallet distribution */}
      {stats && stats.byWallet && stats.byWallet.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Po denarnicah</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {stats.byWallet.map((w) => {
                const cfg = walletConfig[w.walletType] || walletConfig.nfc_card
                const Icon = cfg.icon
                return (
                  <div key={w.walletType} className="border border-border rounded-md p-3 text-center">
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${cfg.color} mb-2`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-xs font-medium">{cfg.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {w.count} plačil
                    </div>
                    <div className="text-sm font-bold">€{w.amount.toFixed(2)}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Status:</span>
        {['all', 'pending', 'authorized', 'captured', 'failed', 'refunded'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'Vse' : statusConfig[s]?.label || s}
          </Button>
        ))}
      </div>

      {/* Payments list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Plačila ({payments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Ni plačil s tem filtrom
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {payments.map((payment) => {
                  const wCfg = walletConfig[payment.walletType] || walletConfig.nfc_card
                  const WIcon = wCfg.icon
                  const sCfg = statusConfig[payment.status] || statusConfig.pending
                  const SIcon = sCfg.icon
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${wCfg.color}`}>
                        <WIcon className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{wCfg.label}</span>
                          <Badge variant="outline" className={`text-xs ${sCfg.color}`}>
                            <SIcon className={`h-3 w-3 mr-1 ${payment.status === 'pending' ? 'animate-spin' : ''}`} />
                            {sCfg.label}
                          </Badge>
                          {payment.cardBrand && (
                            <Badge variant="secondary" className="text-xs">
                              {payment.cardBrand} {payment.cardLast4 && `••${payment.cardLast4}`}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(payment.createdAt), 'dd.MM.yyyy HH:mm:ss')}
                          {payment.capturedAt && ` · Realizirano: ${format(new Date(payment.capturedAt), 'HH:mm')}`}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold">€{payment.amount.toFixed(2)}</div>
                        {payment.refundedAmount > 0 && (
                          <div className="text-xs text-orange-600">
                            -€{payment.refundedAmount.toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1">
                        {payment.status === 'authorized' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setCaptureDialog({ id: payment.id, amount: payment.amount })}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Realiziraj
                          </Button>
                        )}
                        {payment.status === 'captured' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRefundDialog({ id: payment.id, maxAmount: payment.amount - payment.refundedAmount })}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Povračilo
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Capture confirmation */}
      <Dialog open={!!captureDialog} onOpenChange={(open) => !open && setCaptureDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Realiziraj plačilo?
            </DialogTitle>
            <DialogDescription>
              Znesek: <strong>€{captureDialog?.amount.toFixed(2)}</strong>
              <br />
              Po realizaciji bo plačilo knjiženo na račun stranke.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCaptureDialog(null)}>
              Prekliči
            </Button>
            <Button
              onClick={() => captureDialog && captureMutation.mutate(captureDialog.id)}
              disabled={captureMutation.isPending}
            >
              {captureMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Potrdi realizacijo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={!!refundDialog} onOpenChange={(open) => !open && setRefundDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-orange-600" />
              Povračilo plačila
            </DialogTitle>
            <DialogDescription>
              Maksimalni znesek za povračilo: <strong>€{refundDialog?.maxAmount.toFixed(2)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Znesek povračila (EUR)</Label>
            <Input
              id="refund-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={refundDialog?.maxAmount}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(null)}>
              Prekliči
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (refundDialog && refundAmount) {
                  refundMutation.mutate({ id: refundDialog.id, amount: parseFloat(refundAmount) })
                }
              }}
              disabled={refundMutation.isPending || !refundAmount || parseFloat(refundAmount) <= 0}
            >
              {refundMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Izvedi povračilo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- StatCard ---
interface StatCardProps {
  title: string
  value: string | number
  icon: typeof CreditCard
  color: string
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <Card className={`border-2 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium opacity-80">{title}</span>
          <Icon className="h-4 w-4 opacity-60" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

'use client'
// ============================================
// R142-c (epic #115 #29) — Center naprav (Device center)
// POS-shell modul 'devices' (registry + navItems 'Sistem' → permission view_reports).
// Struktura po BriefingModule kanonu: KPI vrstica (StatsCard) + skupine po
// lokaciji (SectionCard + ScrollList max-h-96); Skeleton loading; EN error
// alert + 'Poskusi znova'; iskreno prazno stanje.
// Status badge je deriviran IZKLJUČNO iz isOnline (R142-b kontrakt; DB status
// in 'sleeping' se NE prikazujeta). Rename (admin) + reassign (samo
// super-admin: TENANT_ADMIN_ROLES zrcalilo — klient AuthUser nima locationId,
// strežnik ostane fail-closed 403 in toast pokaže sporočilo).
// Vsi oznaki hardcoded sl (kanon modulov) — samo nav.devices je i18n.
// ============================================

import { memo, useState } from 'react'
import { RefreshCw, Smartphone, Wifi, WifiOff, MapPin, Store, Pencil, ArrowLeftRight } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { StatsCard } from '@/components/pos/StatsCard'
import { SectionCard, BadgeChip, EmptyText, ScrollList } from '@/components/pos/briefing/section-card'
import { cn } from '@/lib/utils'
import { useAuthUser } from '@/components/pos/sidebar/useAuthUser'
import { useDevices, useRenameDevice, useReassignDevice, useActiveLocations } from './useDevices'
import {
  type DeviceRow,
  DEVICE_NAME_MAX,
  deviceTypeBadge,
  deviceStatusBadge,
  formatRelativeLastSeen,
  groupDevicesByLocation,
  isValidDeviceName,
  summarizeDevices,
  NO_LOCATION_GROUP_KEY,
} from './constants'

export const DEVICES_EMPTY_HINT =
  'Naprave se registrirajo samodejno ob prijavi s PIN kodo ali ob naročilu na kiosku.'

export const DevicesModule = memo(function DevicesModule() {
  const { data, isLoading, isError, isFetching, refetch } = useDevices()
  const authUser = useAuthUser()

  // Pooblastila (DailyClosePanel kanon: useAuthUser — reaktiven vzorec Sidebar).
  // PATCH /api/devices/[id] zahteva admin permission → UI gumba po ISTEM pravilu.
  const canRename =
    authUser?.role === 'admin' ||
    authUser?.role === 'super_admin' ||
    (authUser?.permissions?.includes('admin') ?? false)
  // Reassign je strežniško izključno super-admin (scope.locationId null).
  // Klient proxy: TENANT_ADMIN_ROLES {'admin','super_admin'} (tenant-scope.ts) —
  // AuthUser nima locationId, zato lokacijski admin v najslabšem primeru dobi
  // 403 s strežniškim sporočilom v toastu (fail-closed, brez tihega ignoriranja).
  const isTenantAdmin = authUser?.role === 'admin' || authUser?.role === 'super_admin'

  // ─── Dialog stanja (rename + reassign) ───
  const [renameTarget, setRenameTarget] = useState<DeviceRow | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [reassignTarget, setReassignTarget] = useState<DeviceRow | null>(null)
  const [reassignValue, setReassignValue] = useState('')

  const renameMutation = useRenameDevice()
  const reassignMutation = useReassignDevice()
  const locationsQuery = useActiveLocations(isTenantAdmin && reassignTarget != null)

  // Dialog CLOSE (X / ESC / outside click → onOpenChange false) počisti draft
  const closeRename = () => { setRenameTarget(null); setRenameValue(''); renameMutation.reset() }
  const closeReassign = () => { setReassignTarget(null); setReassignValue(''); reassignMutation.reset() }

  // ─── Loading: Skeleton po BriefingModule precedentu ───
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar" aria-busy="true" aria-label="Center naprav se nalaga">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (<Skeleton key={i} className="h-28" />))}
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (<Skeleton key={i} className="h-64" />))}
        </div>
      </div>
    )
  }

  // ─── Error: EN alert + retry (BriefingModule/StockTab kanon, sl besedilo) ───
  if (isError) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <Alert variant="destructive">
          <AlertTitle>Napaka pri nalaganju naprav</AlertTitle>
          <AlertDescription>
            Seznama naprav ni bilo mogoče naložiti. Podatki ostanejo nespremenjeni — poskusite znova.
          </AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Poskusi znova
        </Button>
      </div>
    )
  }

  const devices = data?.devices ?? []
  const kpis = summarizeDevices(devices)
  const groups = groupDevicesByLocation(devices)

  // ─── Empty state: honesto (naprave nastanejo runtime: PIN prijava / kiosk) ───
  if (devices.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Smartphone className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            Center naprav
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Osveži seznam naprav"
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
            Osveži
          </Button>
        </div>
        <EmptyText>Ni registriranih naprav.</EmptyText>
        <p className="mt-1 text-xs text-muted-foreground">{DEVICES_EMPTY_HINT}</p>
      </div>
    )
  }

  const openRename = (device: DeviceRow) => {
    setRenameTarget(device)
    setRenameValue(device.name)
    renameMutation.reset()
  }
  const openReassign = (device: DeviceRow) => {
    setReassignTarget(device)
    setReassignValue(device.locationId ?? '')
    reassignMutation.reset()
  }
  const submitRename = () => {
    if (!renameTarget || !isValidDeviceName(renameValue)) return
    const trimmed = renameValue.trim()
    if (trimmed === renameTarget.name) { closeRename(); return }
    renameMutation.mutate(
      { id: renameTarget.id, body: { name: trimmed } },
      { onSuccess: () => closeRename() },
    )
  }
  const submitReassign = () => {
    if (!reassignTarget || !reassignValue) return
    if (reassignValue === reassignTarget.locationId) { closeReassign(); return }
    reassignMutation.mutate(
      { id: reassignTarget.id, body: { locationId: reassignValue } },
      { onSuccess: () => closeReassign() },
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar">
      {/* ─── Glava ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Smartphone className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            Center naprav
          </h2>
          <p className="text-sm text-muted-foreground">
            Inventar registriranih naprav · online svežina: nazadnje viden ≤ 5 min
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Osveži seznam naprav"
        >
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
          Osveži
        </Button>
      </div>

      {/* ─── KPI vrstica (4 kartice: 2x2 mobilni → 4 stolpci desktop) ─── */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Skupaj naprav" value={kpis.total} icon={Smartphone} />
        <StatsCard title="Online" value={kpis.online} subtitle={kpis.online > 0 ? 'Viden v zadnjih 5 min' : undefined} icon={Wifi} />
        <StatsCard title="Offline" value={kpis.offline} subtitle={kpis.offline > 0 ? 'Ni viden več kot 5 min' : undefined} icon={WifiOff} />
        <StatsCard title="Brez lokacije" value={kpis.unassigned} subtitle={kpis.unassigned > 0 ? 'Dodeli lokacijo (skrbnik)' : undefined} icon={Store} />
      </div>

      {/* ─── Skupine po lokaciji (super-admin: vse; lokacijski admin: ena) ─── */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {groups.map((group) => (
          <SectionCard
            key={group.key}
            icon={group.key === NO_LOCATION_GROUP_KEY ? Store : MapPin}
            title={group.key === NO_LOCATION_GROUP_KEY ? 'Brez lokacije' : group.label}
            count={group.devices.length}
          >
            <ScrollList ariaLabel={`Naprave: ${group.label}`}>
              {group.devices.map((device) => (
                <DeviceRowCard
                  key={device.id}
                  device={device}
                  canRename={canRename}
                  canReassign={isTenantAdmin}
                  onRename={openRename}
                  onReassign={openReassign}
                />
              ))}
            </ScrollList>
          </SectionCard>
        ))}
      </div>

      {/* ─── Dialog: preimenovanje (admin) ─── */}
      <Dialog open={renameTarget != null} onOpenChange={(open) => { if (!open) closeRename() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preimenuj napravo</DialogTitle>
            <DialogDescription>
              Novo ime si bo zapomnila naprava ob naslednji prijavi (1–{DEVICE_NAME_MAX} znakov).
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={DEVICE_NAME_MAX + 10}
            aria-label="Novo ime naprave"
            placeholder="Npr. Blagajna 1"
            autoFocus
          />
          {!isValidDeviceName(renameValue) && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              Ime ne sme biti prazno in sme imeti največ {DEVICE_NAME_MAX} znakov.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeRename}>Prekliči</Button>
            <Button
              size="sm"
              onClick={submitRename}
              disabled={!isValidDeviceName(renameValue) || renameMutation.isPending}
              aria-label="Shrani novo ime naprave"
            >
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: prerazporeditev (izključno super-admin) ─── */}
      <Dialog open={reassignTarget != null} onOpenChange={(open) => { if (!open) closeReassign() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Prerazporedi napravo</DialogTitle>
            <DialogDescription>
              Izberi ciljno lokacijo za napravo «{reassignTarget?.name}».
            </DialogDescription>
          </DialogHeader>
          {locationsQuery.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <select
              value={reassignValue}
              onChange={(e) => setReassignValue(e.target.value)}
              aria-label="Ciljna lokacija naprave"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Izberi lokacijo —</option>
              {locationsQuery.data?.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeReassign}>Prekliči</Button>
            <Button
              size="sm"
              onClick={submitReassign}
              disabled={!reassignValue || reassignMutation.isPending}
              aria-label="Potrdi prerazporeditev naprave"
            >
              Prerazporedi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

// ─── Vrstica naprave (memo — seznam se ne rendera ob dialog state spremembah brez potrebe) ───

interface DeviceRowCardProps {
  device: DeviceRow
  canRename: boolean
  canReassign: boolean
  onRename: (device: DeviceRow) => void
  onReassign: (device: DeviceRow) => void
}

const DeviceRowCard = memo(function DeviceRowCard({
  device, canRename, canReassign, onRename, onReassign,
}: DeviceRowCardProps) {
  const typeBadge = deviceTypeBadge(device.type)
  const statusBadge = deviceStatusBadge(device.isOnline)
  return (
    <li className="flex flex-col gap-1.5 rounded-md border p-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-medium">{device.name}</span>
          <BadgeChip cfg={typeBadge} />
          <BadgeChip cfg={statusBadge} />
        </div>
        <p
          className="mt-0.5 max-w-48 truncate font-mono text-[10px] text-muted-foreground"
          title={device.deviceId}
        >
          {device.deviceId}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground sm:justify-end">
        <div className="min-w-0 text-right">
          <span
            className="tabular-nums"
            title={device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('sl-SI') : undefined}
          >
            {formatRelativeLastSeen(device.lastSeenAt)}
          </span>
          {device.appVersion && (
            <span className="ml-2 tabular-nums">v{device.appVersion}</span>
          )}
        </div>
        {canRename && (
          <button
            type="button"
            onClick={() => onRename(device)}
            aria-label={`Preimenuj napravo ${device.name}`}
            title="Preimenuj"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {canReassign && (
          <button
            type="button"
            onClick={() => onReassign(device)}
            aria-label={`Prerazporedi napravo ${device.name}`}
            title="Prerazporedi na lokacijo"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  )
})

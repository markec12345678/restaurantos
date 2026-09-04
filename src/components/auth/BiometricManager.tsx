'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Fingerprint, Loader2, Plus, Trash2, Smartphone, Monitor, Watch } from 'lucide-react'
import { startRegistration } from '@simplewebauthn/browser'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'

interface BiometricCredential {
  id: string
  credentialId: string
  deviceType: string
  backed: boolean
  nickname: string
  lastUsedAt: string | null
  createdAt: string
}

interface BiometricManagerProps {
  employeeId?: string
}

/**
 * BiometricManager komponenta
 *
 * Prikazuje seznam registriranih biometričnih poverilnic za zaposlenega
 * ter omogoča registracijo novih in brisanje obstoječih.
 */
export function BiometricManager({ employeeId }: BiometricManagerProps) {
  const queryClient = useQueryClient()
  const [isRegistering, setIsRegistering] = useState(false)
  const [nickname, setNickname] = useState('')

  const { data, isLoading } = useQuery<{ employeeId: string; credentials: BiometricCredential[] }>({
    queryKey: employeeId ? ['biometric-credentials', employeeId] : ['biometric-credentials'],
    queryFn: async () => {
      const url = employeeId
        ? `/api/auth/webauthn/credentials?employeeId=${encodeURIComponent(employeeId)}`
        : '/api/auth/webauthn/credentials'
      const res = await authFetch(url)
      if (!res.ok) {
        throw new Error('Napaka pri pridobivanju poverilnic.')
      }
      return res.json()
    },
    enabled: true,
  })

  const registerMutation = useMutation({
    mutationFn: async () => {
      const url = employeeId
        ? `/api/auth/webauthn/register?employeeId=${encodeURIComponent(employeeId)}`
        : '/api/auth/webauthn/register'
      const optsRes = await authFetch(url)
      if (!optsRes.ok) {
        const err = await optsRes.json().catch(() => ({}))
        throw new Error(err.error || 'Napaka pri pripravi registracije.')
      }
      const { options } = await optsRes.json()

      const credential = await startRegistration({ optionsJSON: options })

      const verifyRes = await authFetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          employeeId,
          nickname: nickname.trim(),
        }),
      })
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}))
        throw new Error(err.error || 'Registracija ni uspela.')
      }
      return verifyRes.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Biometrična poverilnica registrirana.')
      setNickname('')
      queryClient.invalidateQueries({ queryKey: ['biometric-credentials'] })
    },
    onError: (err: Error) => {
      if (err.name === 'NotAllowedError') return
      toast.error(err.message || 'Napaka pri registraciji.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (credentialRowId: string) => {
      const res = await authFetch(`/api/auth/webauthn/credentials/${credentialRowId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Napaka pri brisanju.')
      }
    },
    onSuccess: () => {
      toast.success('Poverilnica izbrisana.')
      queryClient.invalidateQueries({ queryKey: ['biometric-credentials'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleRegister = () => {
    setIsRegistering(true)
    registerMutation.mutate(undefined, {
      onSettled: () => setIsRegistering(false),
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Izbrišem to biometrično poverilnico? Po izbrisu bo naprava zahtevala PIN za prijavo.')) {
      return
    }
    deleteMutation.mutate(id)
  }

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === 'singleDevice') return <Smartphone className="h-4 w-4" />
    if (deviceType === 'multiDevice') return <Monitor className="h-4 w-4" />
    return <Fingerprint className="h-4 w-4" />
  }

  const formatLastUsed = (dateStr: string | null) => {
    if (!dateStr) return 'Nikoli'
    const date = new Date(dateStr)
    return date.toLocaleDateString('sl-SI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Biometrične poverilnice
        </CardTitle>
        <CardDescription>
          Registrirajte Touch ID, Face ID, Windows Hello ali drug biometrični ključ za hitro prijavo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 border-b pb-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Vzdevek (npr. &quot;MacBook Pro&quot;)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={100}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Vzdevek naprave"
            />
            <Button
              onClick={handleRegister}
              disabled={isRegistering || registerMutation.isPending}
              size="sm"
            >
              {isRegistering || registerMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Dodaj
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data && data.credentials.length > 0 ? (
          <ul className="space-y-2" aria-label="Seznam biometričnih poverilnic">
            {data.credentials.map((cred) => (
              <li
                key={cred.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  {getDeviceIcon(cred.deviceType)}
                  <div>
                    <p className="text-sm font-medium">
                      {cred.nickname || 'Brez vzdevka'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Zadnja uporaba: {formatLastUsed(cred.lastUsedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cred.backed && (
                    <Badge variant="secondary" className="text-xs">
                      <Watch className="h-3 w-3 mr-1" />
                      Sinhronizirano
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(cred.id)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Izbriši poverilnico ${cred.nickname || 'brez vzdevka'}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Fingerprint className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>Ni registriranih biometričnih poverilnic.</p>
            <p className="text-xs mt-1">Registrirajte novo z gumbom zgoraj.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

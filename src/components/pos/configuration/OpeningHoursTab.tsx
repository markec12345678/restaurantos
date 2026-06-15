'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

const DayRow = dynamic(() => import('./DayRow').then(m => ({ default: m.DayRow })), { ssr: false })

const DAY_NAMES = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
const DAY_SHORT = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob']

interface OpeningHour {
  id?: string
  dayOfWeek: number
  openTime: string
  closeTime: string
  breakStart: string
  breakEnd: string
  isClosed: boolean
}

export function OpeningHoursTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<{ hours: OpeningHour[] }>({
    queryKey: ['opening-hours'],
    queryFn: async () => {
      const res = await authFetch('/api/opening-hours')
      if (!res.ok) return { hours: [] }
      return res.json()
    },
  })
  const [editHours, setEditHours] = useState<OpeningHour[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const hours = data?.hours || []
  const startEdit = () => {
    const existing = new Map(hours.map(h => [h.dayOfWeek, h]))
    const all7: OpeningHour[] = Array.from({ length: 7 }, (_, i) => {
      const ex = existing.get(i)
      return ex || { dayOfWeek: i, openTime: '08:00', closeTime: '22:00', breakStart: '', breakEnd: '', isClosed: i === 0 }
    })
    setEditHours(all7)
    setEditing(true)
  }
  const updateDay = (idx: number, field: keyof OpeningHour, value: string | boolean) => {
    setEditHours(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }
  const save = async () => {
    setSaving(true)
    try {
      const res = await authFetch('/api/opening-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: editHours.map(({ id: _id, ...rest }) => rest) }),
      })
      if (!res.ok) throw new Error('Napaka')
      toast.success('Delovni čas shranjen')
      queryClient.invalidateQueries({ queryKey: ['opening-hours'] })
      setEditing(false)
    } catch {
      toast.error('Napaka pri shranjevanju')
    } finally {
      setSaving(false)
    }
  }
  if (isLoading) return <div className="space-y-3">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
  const now = new Date()
  const todayIdx = now.getDay()
  const todayHours = hours.find(h => h.dayOfWeek === todayIdx)
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const isOpenNow = todayHours && !todayHours.isClosed && currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime
  return (
    <div className="space-y-4">
      {/* Status indikator */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${isOpenNow ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className={`w-3 h-3 rounded-full ${isOpenNow ? 'bg-green-500' : 'bg-red-500'}`}><span className="sr-only">{isOpenNow ? 'Odprto' : 'Zaprto'}</span></div>
        <span className={`font-semibold ${isOpenNow ? 'text-green-700' : 'text-red-700'}`}>
          {isOpenNow ? 'Trenutno odprto' : 'Trenutno zaprto'}
        </span>
        {todayHours && !todayHours.isClosed && (
          <span className="text-sm text-muted-foreground">
            ({todayHours.openTime} - {todayHours.closeTime})
          </span>
        )}
      </div>
      {!editing ? (
        <>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">Dan</th>
                  <th className="text-center p-3 font-medium">Odprtje</th>
                  <th className="text-center p-3 font-medium">Zaprtje</th>
                  <th className="text-center p-3 font-medium">Odmor</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr></thead>
              <tbody>
                {Array.from({ length: 7 }, (_, i) => {
                  const h = hours.find(x => x.dayOfWeek === i)
                  const isToday = i === todayIdx
                  return (
                    <tr key={i} className={`border-b last:border-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
                      <td className={`p-3 font-medium ${isToday ? 'text-blue-700' : ''}`}>
                        {DAY_NAMES[i]} {isToday && <Badge className="ml-1 text-[10px] bg-blue-600">Danes</Badge>}
                      </td>
                      <td className="p-3 text-center">{h?.isClosed ? '—' : h?.openTime || '—'}</td>
                      <td className="p-3 text-center">{h?.isClosed ? '—' : h?.closeTime || '—'}</td>
                      <td className="p-3 text-center text-xs text-muted-foreground">
                        {h?.breakStart && h?.breakEnd ? `${h.breakStart} - ${h.breakEnd}` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={h?.isClosed ? 'destructive' : 'default'} className={h?.isClosed ? '' : 'bg-green-600'}>
                          {h?.isClosed ? 'Zaprto' : 'Odprto'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Button onClick={startEdit} className="gap-2">
            <Pencil className="h-4 w-4" /> Uredi delovni čas
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-3">
            {editHours.map((h, idx) => (
              <DayRow
                key={idx}
                dayShort={DAY_SHORT[idx]}
                hour={h}
                onUpdate={(field, value) => updateDay(idx, field, value)}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? 'Shranjujem...' : 'Shrani delovni čas'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Prekliči</Button>
          </div>
        </>
      )}
    </div>
  )
}

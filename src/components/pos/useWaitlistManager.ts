'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import type { WaitlistFormRow } from '@/lib/types'
import { type WaitlistEntry } from './waitlist/constants'

export function useWaitlistManager() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<WaitlistFormRow>({} as WaitlistFormRow)
  const [now, setNow] = useState(new Date())

  const fetchEntries = useCallback(async () => {
    try {
      const res = await authFetch('/api/waitlist')
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Napaka pri nalaganju čakalne vrste')
    }
  }, [])

  useEffect(() => {
    const doFetch = async () => { await fetchEntries(); setNow(new Date()) }
    doFetch()
    const interval = setInterval(doFetch, 30000)
    return () => clearInterval(interval)
  }, [fetchEntries])

  const openForm = useCallback(() => {
    setShowForm(true)
    setForm({ guestName: '', guestPhone: '', partySize: 2, quotedWaitMinutes: 15, preferredArea: '', specialNeeds: '', notes: '' })
  }, [])

  const closeForm = useCallback(() => setShowForm(false), [])

  const addEntry = useCallback(async () => {
    try {
      const res = await authFetch('/api/waitlist', { method: 'POST', body: JSON.stringify(form) })
      if (res.ok) { setShowForm(false); setForm({} as WaitlistFormRow); fetchEntries() }
    } catch { toast.error('Napaka pri dodajanju v čakalno vrsto') }
  }, [form, fetchEntries])

  const updateEntry = useCallback(async (id: string, action: string) => {
    try {
      const res = await authFetch(`/api/waitlist/${id}`, { method: 'PUT', body: JSON.stringify({ action }) })
      if (res.ok) fetchEntries()
    } catch { toast.error('Napaka pri posodabljanju čakalne vrste') }
  }, [fetchEntries])

  const getWaitTime = useCallback((checkedInAt: string): number => {
    return Math.round((now.getTime() - new Date(checkedInAt).getTime()) / 60000)
  }, [now])

  const updateForm = useCallback((field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const waiting = useMemo(() => entries.filter(e => e.status === 'waiting'), [entries])
  const notified = useMemo(() => entries.filter(e => e.status === 'notified'), [entries])
  const totalGuests = useMemo(() =>
    entries.reduce((sum, e) => sum + (e.status === 'waiting' || e.status === 'notified' ? e.partySize : 0), 0), [entries])

  return {
    entries, waiting, notified, totalGuests,
    showForm, form, now,
    fetchEntries, openForm, closeForm, addEntry, updateEntry,
    getWaitTime, updateForm, setShowForm,
  }
}

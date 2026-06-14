'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { authFetch } from '@/components/pos/PinLogin';
import { toast } from 'sonner'
import type { WaitlistFormRow } from '@/lib/types';
import dynamic from 'next/dynamic'
import { type WaitlistEntry } from './waitlist/constants'

// Lazy-loaded podkomponente
const WaitlistHeader = dynamic(() => import('./waitlist/WaitlistHeader').then(m => ({ default: m.WaitlistHeader })), { ssr: false })
const WaitlistStatsBar = dynamic(() => import('./waitlist/WaitlistStatsBar').then(m => ({ default: m.WaitlistStatsBar })), { ssr: false })
const WaitlistEntryCard = dynamic(() => import('./waitlist/WaitlistEntryCard').then(m => ({ default: m.WaitlistEntryCard })), { ssr: false })
const WaitlistEmptyState = dynamic(() => import('./waitlist/WaitlistEmptyState').then(m => ({ default: m.WaitlistEmptyState })), { ssr: false })
const WaitlistFormDialog = dynamic(() => import('./waitlist/WaitlistFormDialog').then(m => ({ default: m.WaitlistFormDialog })), { ssr: false })

export default memo(function WaitlistManager() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WaitlistFormRow>({} as WaitlistFormRow);
  const [now, setNow] = useState(new Date());

  // ============================================
  // NALAGANJE PODATKOV
  // ============================================

  const fetchEntries = useCallback(async () => {
    try {
      const res = await authFetch('/api/waitlist');
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Napaka pri nalaganju čakalne vrste')
    }
  }, []);

  useEffect(() => {
    // Začetni fetch — uporabimo void, ker ESLint pravi, da setState v effect
    // povzroča cascading renders. Tukaj je to nujno (fetch → setState),
    // zato uporabimo startTransition, da se izognemo ESLint opozorilu.
    const doFetch = async () => { await fetchEntries(); setNow(new Date()); };
    doFetch();
    const interval = setInterval(doFetch, 30000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  // ============================================
  // HANDLERJI
  // ============================================

  const openForm = useCallback(() => {
    setShowForm(true);
    setForm({ guestName: '', guestPhone: '', partySize: 2, quotedWaitMinutes: 15, preferredArea: '', specialNeeds: '', notes: '' });
  }, []);

  const closeForm = useCallback(() => setShowForm(false), []);

  const addEntry = useCallback(async () => {
    try {
      const res = await authFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({} as WaitlistFormRow);
        fetchEntries();
      }
    } catch {
      toast.error('Napaka pri dodajanju v čakalno vrsto')
    }
  }, [form, fetchEntries]);

  const updateEntry = useCallback(async (id: string, action: string, _extra?: Record<string, unknown>) => {
    try {
      const res = await authFetch(`/api/waitlist/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      });
      if (res.ok) fetchEntries();
    } catch {
      toast.error('Napaka pri posodabljanju čakalne vrste')
    }
  }, [fetchEntries]);

  const getWaitTime = useCallback((checkedInAt: string): number => {
    return Math.round((now.getTime() - new Date(checkedInAt).getTime()) / 60000);
  }, [now]);

  const updateForm = useCallback((field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // ============================================
  // IZPELJANA STANJA
  // ============================================

  const waiting = useMemo(() => entries.filter(e => e.status === 'waiting'), [entries]);
  const notified = useMemo(() => entries.filter(e => e.status === 'notified'), [entries]);
  const totalGuests = useMemo(() =>
    entries.reduce((sum, e) => sum + (e.status === 'waiting' || e.status === 'notified' ? e.partySize : 0), 0),
    [entries]
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <WaitlistHeader
        waitingCount={waiting.length}
        notifiedCount={notified.length}
        onOpenForm={openForm}
      />

      {/* Stats Bar */}
      <WaitlistStatsBar
        waitingCount={waiting.length}
        notifiedCount={notified.length}
        totalGuests={totalGuests}
      />

      {/* Waitlist */}
      <div className="flex-1 overflow-y-auto">
        {[...waiting, ...notified].map((entry, index) => {
          const waitTime = getWaitTime(entry.checkedInAt);
          const isOverQuoted = entry.quotedWaitMinutes > 0 && waitTime > entry.quotedWaitMinutes;
          const isNotified = entry.status === 'notified';

          return (
            <WaitlistEntryCard
              key={entry.id}
              entry={entry}
              index={index}
              waitTime={waitTime}
              isOverQuoted={isOverQuoted}
              isNotified={isNotified}
              onNotify={() => updateEntry(entry.id, 'notify')}
              onSeat={() => updateEntry(entry.id, 'seat')}
              onLeave={() => updateEntry(entry.id, 'leave')}
            />
          );
        })}

        {waiting.length === 0 && notified.length === 0 && (
          <WaitlistEmptyState />
        )}
      </div>

      {/* Add to Waitlist Dialog */}
      <WaitlistFormDialog
        open={showForm}
        form={form as unknown as Record<string, unknown>}
        onOpenChange={setShowForm}
        onUpdateForm={updateForm}
        onAddEntry={addEntry}
        onCancel={closeForm}
      />
    </div>
  );
})

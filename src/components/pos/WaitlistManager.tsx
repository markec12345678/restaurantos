'use client';

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useWaitlistManager } from './useWaitlistManager'

const WaitlistHeader = dynamic(() => import('./waitlist/WaitlistHeader').then(m => ({ default: m.WaitlistHeader })), { ssr: false })
const WaitlistStatsBar = dynamic(() => import('./waitlist/WaitlistStatsBar').then(m => ({ default: m.WaitlistStatsBar })), { ssr: false })
const WaitlistEntryCard = dynamic(() => import('./waitlist/WaitlistEntryCard').then(m => ({ default: m.WaitlistEntryCard })), { ssr: false })
const WaitlistEmptyState = dynamic(() => import('./waitlist/WaitlistEmptyState').then(m => ({ default: m.WaitlistEmptyState })), { ssr: false })
const WaitlistFormDialog = dynamic(() => import('./waitlist/WaitlistFormDialog').then(m => ({ default: m.WaitlistFormDialog })), { ssr: false })

export default memo(function WaitlistManager() {
  const {
    waiting, notified, totalGuests,
    showForm, form, getWaitTime, updateForm,
    addEntry, closeForm, openForm, updateEntry, setShowForm,
  } = useWaitlistManager()

  return (
    <div className="h-full flex flex-col">
      <WaitlistHeader waitingCount={waiting.length} notifiedCount={notified.length} onOpenForm={openForm} />
      <WaitlistStatsBar waitingCount={waiting.length} notifiedCount={notified.length} totalGuests={totalGuests} />
      <div className="flex-1 overflow-y-auto">
        {[...waiting, ...notified].map((entry, index) => {
          const waitTime = getWaitTime(entry.checkedInAt)
          const isOverQuoted = entry.quotedWaitMinutes > 0 && waitTime > entry.quotedWaitMinutes
          const isNotified = entry.status === 'notified'
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
          )
        })}
        {waiting.length === 0 && notified.length === 0 && <WaitlistEmptyState />}
      </div>
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

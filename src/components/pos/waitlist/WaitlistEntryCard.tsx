'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { type WaitlistEntryCardProps, getWaitTimeColor } from './constants'

// Posamezen vnos v čakalni vrsti
export const WaitlistEntryCard = memo(function WaitlistEntryCard({
  entry,
  index,
  waitTime,
  isOverQuoted,
  isNotified,
  onNotify,
  onSeat,
  onLeave,
}: WaitlistEntryCardProps) {
  return (
    <div
      className={`p-3 border-b transition ${
        isNotified ? 'bg-blue-50' : isOverQuoted ? 'bg-red-50' : 'bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Position Number */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
          isNotified ? 'bg-blue-500' : isOverQuoted ? 'bg-red-500' : 'bg-orange-500'
        }`} aria-label={isNotified ? 'Obveščen' : isOverQuoted ? 'Časa preveč' : 'Čaka'}>
          {index + 1}
        </div>

        {/* Guest Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{entry.guestName}</span>
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
              {entry.partySize} oseb
            </span>
            {isNotified && (
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] animate-pulse">
                Obveščen
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs font-medium ${getWaitTimeColor(waitTime, entry.quotedWaitMinutes)}`}>
              Čaka {waitTime} min
              {entry.quotedWaitMinutes > 0 && ` / obljubljenih ${entry.quotedWaitMinutes} min`}
            </span>
          </div>

          {entry.preferredArea && (
            <span className="text-[10px] text-gray-500">{entry.preferredArea}</span>
          )}
          {entry.specialNeeds && (
            <span className="text-[10px] text-purple-600 ml-2">{entry.specialNeeds}</span>
          )}
          {entry.notes && (
            <p className="text-[10px] text-gray-500 mt-0.5">{entry.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          {!isNotified && (
            <Button
              size="sm"
              onClick={onNotify}
              className="bg-blue-500 hover:bg-blue-600 text-white text-xs h-7 px-2"
              aria-label="Obvesti gosta"
            >
              Obvesti
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSeat}
            className="bg-green-500 hover:bg-green-600 text-white text-xs h-7 px-2"
            aria-label="Usedi gosta"
          >
            Usedi
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onLeave}
            className="text-xs h-7 px-2"
            aria-label="Označi kot odšel"
          >
            Odšel
          </Button>
        </div>
      </div>
    </div>
  )
})

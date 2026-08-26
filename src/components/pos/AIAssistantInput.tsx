'use client'

import { memo } from 'react'

interface ChatInputProps {
  value: string
  onChange: (_value: string) => void
  onSend: () => void
  disabled: boolean
}

export const ChatInput = memo(function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  return (
    <div className="p-3 border-t bg-white">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          placeholder="Vprašajte karkoli..."
          aria-label="Sporočilo za AI asistenta"
          className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          disabled={disabled}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label="Pošlji sporočilo"
          className="bg-violet-600 text-white rounded-xl px-3 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition"
        >
          ➤
        </button>
      </div>
    </div>
  )
})

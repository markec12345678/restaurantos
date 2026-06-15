'use client'

import { memo, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatMessagesProps {
  messages: Message[]
  loading: boolean
}

export const ChatMessages = memo(function ChatMessages({ messages, loading }: ChatMessagesProps) {
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ maxHeight: '40vh' }}>
      {messages.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p className="text-4xl mb-2">🍽️</p>
          <p className="text-sm">Pozdravljeni! Kako vam lahko pomagam?</p>
        </div>
      )}
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-br-md'
                : 'bg-gray-100 text-gray-800 rounded-bl-md'
            }`}
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
            <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-violet-200' : 'text-gray-500'}`}>
              {msg.timestamp.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  )
})

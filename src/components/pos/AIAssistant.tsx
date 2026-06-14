'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { authFetch } from '@/components/pos/PinLogin';
import { useFocusTrap } from '@/lib/use-focus-trap';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { icon: '📊', label: 'Optimizacija menija', prompt: 'Analiziraj moj meni in predlagaj optimizacije. Kateri artikli so zvezde in kateri psi?' },
  { icon: '📦', label: 'Zaloga', prompt: 'Kaj moram naročiti pri dobaviteljih? Katera zaloga je nizka?' },
  { icon: '📈', label: 'Napoved prodaje', prompt: 'Kakšna bo prodaja naslednji teden glede na zgodovinske podatke?' },
  { icon: '👥', label: 'Kadrovska', prompt: 'Koliko osebja potrebujem za naslednji teden?' },
  { icon: '💰', label: 'Food cost', prompt: 'Kakšen je moj povprečni food cost % in kje ga lahko znižam?' },
  { icon: '🎯', label: 'Promocije', prompt: 'Predlagaj promocije za povečanje obiska v mirnejših dneh.' },
];

export default memo(function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Escape key handler to close the panel
  const closePanel = useCallback(() => setIsOpen(false), []);
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closePanel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await authFetch('/api/ai-assistant', {
        method: 'POST',
        body: JSON.stringify({ message: text, type: 'general' }),
      });

      const data = await res.json();
      const aiMessage: Message = {
        role: 'assistant',
        content: data.response || data.error || 'Oprostite, nisem mogel odgovoriti.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Oprostite, prišlo je do napake. Poskusite znova.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

  return (
    <>
      {/* Floating AI Button */}
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full p-4 shadow-2xl hover:shadow-violet-500/30 active:scale-95 transition-all"
        title="AI Asistent"
        aria-label={isOpen ? 'Zapri AI asistenta' : 'Odpri AI asistenta'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-2xl">🤖</span>
        )}
      </button>

      {/* AI Chat Panel */}
      {isOpen && (
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label="AI Asistent" className="fixed bottom-24 right-6 z-50 w-96 max-h-[70vh] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="font-bold text-sm">RestaurantOS AI</h3>
                <p className="text-xs text-violet-200">Vaš pametni asistent</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          {messages.length === 0 && (
            <div className="p-3 border-b bg-violet-50/50">
              <p className="text-xs text-gray-500 mb-2 px-1">Hitra vprašanja:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_ACTIONS.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(action.prompt)}
                    className="text-left px-2 py-1.5 rounded-lg bg-white border border-violet-100 hover:bg-violet-50 text-xs transition"
                  >
                    {action.icon} {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
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

          {/* Input */}
          <div className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                placeholder="Vprašajte karkoli..."
                aria-label="Sporočilo za AI asistenta"
                className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                aria-label="Pošlji sporočilo"
                className="bg-violet-600 text-white rounded-xl px-3 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
})

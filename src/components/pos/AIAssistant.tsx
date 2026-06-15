'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { authFetch } from '@/components/pos/PinLogin';
import { useFocusTrap } from '@/lib/use-focus-trap';
import { QuickActionsBar } from './AIAssistantQuickActions';
import { ChatMessages } from './AIAssistantMessages';
import { ChatInput } from './AIAssistantInput';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default memo(function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen);

  const closePanel = useCallback(() => setIsOpen(false), []);
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closePanel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

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
          {messages.length === 0 && <QuickActionsBar onSelect={sendMessage} />}

          {/* Messages */}
          <ChatMessages messages={messages} loading={loading} />

          {/* Input */}
          <ChatInput value={input} onChange={setInput} onSend={() => sendMessage(input)} disabled={loading} />
        </div>
      )}
    </>
  );
})

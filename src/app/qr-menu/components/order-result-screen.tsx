'use client';

import { memo } from 'react';
import type { OrderResult } from '../types';

export interface OrderConfirmedScreenProps {
  isDark: boolean;
  orderResult: OrderResult;
  onContinue: () => void;
}

export const OrderConfirmedScreen = memo(function OrderConfirmedScreen({ isDark, orderResult, onContinue }: OrderConfirmedScreenProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-green-50 to-emerald-100'}`} role="alert" aria-live="polite">
      <div className={`text-center ${isDark ? 'bg-gray-900' : 'bg-white/80'} backdrop-blur-xl rounded-3xl shadow-2xl p-8 mx-4 max-w-md border ${isDark ? 'border-gray-800' : 'border-white/50'}`}>
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30" aria-hidden="true">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}>Naročilo sprejeto!</h2>
        <p className={`mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Vaše naročilo je v obdelavi</p>
        {orderResult.order && (
          <>
            <p className="text-amber-600 font-mono text-lg font-bold mt-3" aria-label={`Številka naročila: ${orderResult.order.orderNumber}`}>#{orderResult.order.orderNumber}</p>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Predviden čas: ~{orderResult.order.estimatedTime}
            </p>
          </>
        )}
        <button
          onClick={onContinue}
          className="mt-6 bg-amber-500 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-amber-600 active:scale-95 transition shadow-lg shadow-amber-500/30"
          aria-label="Naroči še kaj"
        >
          Naroči še kaj
        </button>
      </div>
    </div>
  );
});

export interface OrderErrorScreenProps {
  isDark: boolean;
  orderResult: OrderResult;
  onRetry: () => void;
}

export const OrderErrorScreen = memo(function OrderErrorScreen({ isDark, orderResult, onRetry }: OrderErrorScreenProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-red-50 to-orange-100'}`} role="alert" aria-live="assertive">
      <div className={`text-center ${isDark ? 'bg-gray-900' : 'bg-white/80'} backdrop-blur-xl rounded-3xl shadow-2xl p-8 mx-4 max-w-md border ${isDark ? 'border-gray-800' : 'border-white/50'}`}>
        <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/30" aria-hidden="true">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>Napaka</h2>
        <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{orderResult.error}</p>
        <button
          onClick={onRetry}
          className="mt-6 bg-amber-500 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-amber-600 active:scale-95 transition"
          aria-label="Poskusi znova"
        >
          Poskusi znova
        </button>
      </div>
    </div>
  );
});

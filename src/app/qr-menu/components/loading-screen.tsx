'use client';

import { memo } from 'react';

export interface LoadingScreenProps {
  isDark: boolean;
}

export const LoadingScreen = memo(function LoadingScreen({ isDark }: LoadingScreenProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100'}`} role="alert" aria-live="polite" aria-label="Nalaganje menija">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-amber-200 dark:border-gray-700"></div>
          <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
          <div className="absolute inset-3 rounded-full bg-amber-500 flex items-center justify-center text-white text-2xl" aria-hidden="true">🍽</div>
        </div>
        <p className={`text-lg font-semibold ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>Nalagam meni...</p>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-amber-600'}`}>Pripravljam digitalni jedilnik</p>
      </div>
    </div>
  );
});

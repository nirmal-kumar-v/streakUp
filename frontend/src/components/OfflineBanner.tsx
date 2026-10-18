import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const OfflineBanner: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) {
    return null;
  }

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-amber-950/80 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 backdrop-blur-md animate-fadeIn sticky top-0 z-40"
      >
        <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>You are currently offline. Viewing cached content. Reconnect to sync streaks and habits.</span>
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-200 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 backdrop-blur-md animate-fadeIn sticky top-0 z-40"
      >
        <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Connection restored! You are back online.</span>
      </div>
    );
  }

  return null;
};

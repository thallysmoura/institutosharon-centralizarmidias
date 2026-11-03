'use client';
import { useEffect } from 'react';

/** Registra o service worker (instalação no celular) e bloqueia o zoom por pinça, como em um aplicativo. */
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => null);
    const bloquear = (e: Event) => e.preventDefault();
    const pinca = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    document.addEventListener('gesturestart', bloquear); // Safari/iOS
    document.addEventListener('gesturechange', bloquear);
    document.addEventListener('touchmove', pinca, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', bloquear);
      document.removeEventListener('gesturechange', bloquear);
      document.removeEventListener('touchmove', pinca);
    };
  }, []);
  return null;
}

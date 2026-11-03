'use client';
import { useEffect } from 'react';

/** Registra o service worker (necessário para instalar o app no celular). */
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => null);
  }, []);
  return null;
}

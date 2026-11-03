'use client';
import { useEffect, useState } from 'react';

type PromptInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let guardado: PromptInstalar | null = null;
const ouvintes = new Set<() => void>();

/** Captura o convite de instalação do navegador (dispara uma única vez, cedo); o botão "Instalar" usa depois. */
export function capturarInstalacao() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); guardado = e as PromptInstalar; ouvintes.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { guardado = null; ouvintes.forEach((f) => f()); });
}

/** `instalar` é null quando o app já está instalado ou o navegador não oferece a instalação (ex.: iPhone: Compartilhar → Adicionar à Tela de Início). */
export function useInstalar() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); ouvintes.add(f); return () => { ouvintes.delete(f); }; }, []);
  return guardado ? async () => { const p = guardado!; await p.prompt(); await p.userChoice; guardado = null; ouvintes.forEach((f) => f()); } : null;
}

/** Celular/tablet (toque): evita abrir o teclado sozinho ao entrar numa tela. */
export const ehToque = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

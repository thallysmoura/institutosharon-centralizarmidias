'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Me } from './api';

/** Presença: batida leve a cada 40 s; vira "ausente" com a aba oculta ou sem interação por 3 min. */
function usePresenca(ligado: boolean) {
  useEffect(() => {
    if (!ligado) return;
    let ultima = Date.now();
    const marca = () => { ultima = Date.now(); };
    const bate = () => {
      const ausente = document.visibilityState === 'hidden' || Date.now() - ultima > 3 * 60_000;
      api('/presenca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: ausente ? 'ausente' : 'ativo' }) }).catch(() => null);
    };
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, marca, { passive: true }));
    document.addEventListener('visibilitychange', bate);
    bate();
    const t = setInterval(bate, 40_000);
    return () => { clearInterval(t); eventos.forEach((e) => window.removeEventListener(e, marca)); document.removeEventListener('visibilitychange', bate); };
  }, [ligado]);
}

/** Exige sessão com o perfil informado (vindo do banco); redireciona quando não confere. */
export function useSession(role: Me['role']) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>('/auth/me')
      .then((u) => (u.role === role ? setMe(u) : router.replace(u.role === 'ADMIN' ? '/admin' : '/aluno')))
      .catch(() => router.replace('/login'));
  }, [role, router]);

  usePresenca(!!me);

  const sair = useCallback(async () => {
    await api('/presenca', { method: 'DELETE' }).catch(() => null);
    await api('/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/login');
  }, [router]);

  const recarregar = useCallback(() => api<Me>('/auth/me').then(setMe).catch(() => null), []);

  return { me, sair, recarregar };
}

export const fmtDia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
export const nomeLimpo = (n: string) => n.replace(/ \(.*\)$/, '');

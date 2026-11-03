'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Me } from './api';

/** Exige sessão com o perfil informado (vindo do banco); redireciona quando não confere. */
export function useSession(role: Me['role']) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>('/auth/me')
      .then((u) => (u.role === role ? setMe(u) : router.replace(u.role === 'ADMIN' ? '/admin' : '/aluno')))
      .catch(() => router.replace('/login'));
  }, [role, router]);

  const sair = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/login');
  }, [router]);

  return { me, sair };
}

export const fmtDia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
export const nomeLimpo = (n: string) => n.replace(/ \(.*\)$/, '');

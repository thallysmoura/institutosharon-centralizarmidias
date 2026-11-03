'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Me } from '@/lib/api';
import PageLoader from '@/components/PageLoader';

/** Direciona pelo perfil vindo do banco: ADMIN → painel geral, ALUNO → área de envio. */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    api<Me>('/auth/me')
      .then((me) => router.replace((me.role === 'ADMIN' ? '/admin' : '/aluno') + window.location.search))
      .catch(() => router.replace('/login'));
  }, [router]);
  return <PageLoader />;
}

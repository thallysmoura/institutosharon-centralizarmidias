'use client';
import TelaErro from '@/components/TelaErro';

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <TelaErro erro={error} reset={reset} />;
}

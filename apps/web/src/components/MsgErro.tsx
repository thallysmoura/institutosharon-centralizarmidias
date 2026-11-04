'use client';
import { useEffect, useState } from 'react';

/** Mensagem de erro de um campo: aparece suavemente, fica alguns segundos e some com fade. Reaparece quando `texto` ou `chave` mudam. */
export default function MsgErro({ texto, chave, onSumir }: { texto?: string; chave?: string; onSumir?: () => void }) {
  const [fase, setFase] = useState<'visivel' | 'saindo' | 'oculto'>('visivel');
  useEffect(() => {
    if (!texto) return;
    setFase('visivel');
    const a = setTimeout(() => setFase('saindo'), 4200);
    const b = setTimeout(() => { setFase('oculto'); onSumir?.(); }, 4800);
    return () => { clearTimeout(a); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, chave]);
  if (!texto || fase === 'oculto') return null;
  return <p role="alert" className={`${fase === 'saindo' ? 'opacity-0' : 'fade-in'} mt-1.5 px-[1.2em] text-[0.76em] font-medium leading-snug text-[#b3261e] transition-opacity duration-500`}>{texto}</p>;
}

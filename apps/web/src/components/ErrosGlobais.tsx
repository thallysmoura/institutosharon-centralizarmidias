'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, X } from 'lucide-react';

const GENERICA = 'Algo não saiu como esperado. Tente novamente.';

/** Rede de segurança: falhas não tratadas (promessas rejeitadas ou erros soltos) viram um aviso discreto, em vez de quebrar a tela ou ficar só no console. */
export default function ErrosGlobais() {
  const [msg, setMsg] = useState('');
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const mostrar = (m: string) => {
      setMsg(m);
      clearTimeout(t.current);
      t.current = setTimeout(() => setMsg(''), 6000);
    };
    const texto = (e: unknown) => {
      const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
      return m && m.length < 140 && !/^(TypeError|ReferenceError|SyntaxError)/.test(m) && /[a-záéíóúãõç]{3}/i.test(m) && !/undefined|null|is not|cannot|failed to fetch|NetworkError|chunk/i.test(m) ? m : GENERICA;
    };
    const rejeicao = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string } | undefined;
      if (r?.name === 'AbortError') return;
      e.preventDefault();
      console.error('[falha não tratada]', e.reason);
      mostrar(texto(e.reason));
    };
    const erro = (e: ErrorEvent) => {
      if (/ResizeObserver loop/i.test(e.message)) { e.preventDefault(); return; }
      console.error('[erro]', e.error ?? e.message);
      mostrar(GENERICA);
    };
    window.addEventListener('unhandledrejection', rejeicao);
    window.addEventListener('error', erro);
    return () => { window.removeEventListener('unhandledrejection', rejeicao); window.removeEventListener('error', erro); clearTimeout(t.current); };
  }, []);

  if (!msg) return null;
  return (
    <div role="alert" className="pop fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[200] mx-auto flex max-w-[420px] items-start gap-3 rounded-2xl border border-[#f0c5c0] bg-white p-3.5 shadow-[0_18px_44px_-16px_rgba(33,24,13,.5)]">
      <CircleAlert size={20} className="mt-0.5 shrink-0 text-[#b3261e]" />
      <p className="min-w-0 flex-1 text-[0.88rem] font-medium leading-snug text-ink/85">{msg}</p>
      <button type="button" onClick={() => setMsg('')} aria-label="Fechar aviso" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/50 hover:bg-sand"><X size={15} /></button>
    </div>
  );
}

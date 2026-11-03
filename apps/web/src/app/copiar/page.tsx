'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Copy } from 'lucide-react';
import { Wordmark } from '@/components/Brand';

function Conteudo() {
  const codigo = (useSearchParams().get('c') ?? '').replace(/\D/g, '').slice(0, 4);
  const [ok, setOk] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
    } catch {
      const t = document.createElement('textarea');
      t.value = codigo;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setOk(true);
  }

  useEffect(() => { if (codigo.length === 4) copiar(); }, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6 py-10 sm:bg-gradient-to-b sm:from-white sm:to-[#f7f3ea]">
      <section className="w-full max-w-[400px] text-center">
        <div className="flex justify-center"><Wordmark stacked /></div>
        {codigo.length === 4 ? (
          <div className="mt-8">
            <p className="eyebrow">Código de confirmação</p>
            <p className="mt-3 flex justify-center gap-2" aria-label={`Código ${codigo}`}>
              {codigo.split('').map((d, i) => <span key={i} className="grid h-16 w-14 place-items-center rounded-2xl border border-gold-300 bg-[#fbf6e8] font-display text-[2rem] font-bold text-gold-700">{d}</span>)}
            </p>
            <button type="button" onClick={copiar} className="btn btn-gold mt-6 w-full">{ok ? <><Check size={18} />Código copiado!</> : <><Copy size={18} />Copiar código</>}</button>
            <p className="mt-4 text-[0.85rem] text-ink/60">{ok ? 'Agora volte ao sistema, toque na primeira caixa e cole o código.' : 'Toque no botão para copiar.'}</p>
          </div>
        ) : (
          <p className="mt-8 text-sm text-ink/60">Link inválido. Use o código recebido por e-mail.</p>
        )}
      </section>
    </main>
  );
}

export default function Copiar() {
  return <Suspense><Conteudo /></Suspense>;
}

'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, TriangleAlert, SearchX } from 'lucide-react';

/** Tela amigável para falhas de carregamento (`tipo="erro"`) e páginas inexistentes (`tipo="naoEncontrada"`): sem detalhes técnicos para o usuário. */
export default function TelaErro({ tipo = 'erro', erro, reset }: { tipo?: 'erro' | 'naoEncontrada'; erro?: Error & { digest?: string }; reset?: () => void }) {
  useEffect(() => { if (erro) console.error('[tela]', erro.digest ?? '', erro.message); }, [erro]); // detalhe só no console, nunca na tela
  const nf = tipo === 'naoEncontrada';
  const Icone = nf ? SearchX : TriangleAlert;
  return (
    <main className="grid min-h-dvh place-items-center bg-page px-5 py-10">
      <div className="pop w-full max-w-[420px] text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Icone size={30} strokeWidth={1.6} /></span>
        <h1 className="mt-5 text-[1.5rem] font-bold leading-tight">{nf ? 'Página não encontrada' : 'Algo não saiu como esperado'}</h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/65">{nf ? 'O endereço pode ter mudado ou não existe mais.' : 'Não foi possível carregar esta tela agora. Suas informações estão seguras. Tente novamente em instantes.'}</p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          {reset && <button type="button" onClick={reset} className="btn btn-gold !min-h-[46px] !gap-2 !px-6"><RefreshCw size={16} />Tentar novamente</button>}
          <Link href="/" className="btn btn-line !min-h-[46px] !px-6">Ir para o início</Link>
        </div>
      </div>
    </main>
  );
}

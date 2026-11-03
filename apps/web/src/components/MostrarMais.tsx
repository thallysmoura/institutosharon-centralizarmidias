'use client';
import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import Spinner from './Spinner';

export const PASSO = 30;

/**
 * Rodapé de lista paginada: botão "Mostrar mais" (sempre disponível) e, com `auto`, carrega a próxima página
 * sozinho quando o rodapé se aproxima da tela (rolagem infinita), sem depender de o usuário clicar.
 */
export default function MostrarMais({ temMais, carregando = false, onClick, mostrados, auto = false }: { temMais: boolean; carregando?: boolean; onClick: () => void; mostrados?: number; auto?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onClick);
  cb.current = onClick;

  useEffect(() => {
    if (!auto || !temMais || carregando || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) cb.current(); }, { rootMargin: '500px 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [auto, temMais, carregando, mostrados]);

  if (!temMais) return null;
  return (
    <div ref={ref} className="flex justify-center px-4 py-4">
      <button type="button" onClick={onClick} disabled={carregando} className="btn btn-line !min-h-[42px] !gap-2 !px-5 !text-[0.85rem]">
        {carregando ? <Spinner size={15} /> : <ChevronDown size={16} />}Mostrar mais
      </button>
    </div>
  );
}

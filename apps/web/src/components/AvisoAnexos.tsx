'use client';
import { useState } from 'react';
import { Download, ExternalLink, FileText, Link2 } from 'lucide-react';
import { API } from '@/lib/api';
import type { Anexo } from '@/lib/notificacoes';
import { Ampliada } from '@/components/Avatar';

const tam = (n: number | null) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
export const urlAnexo = (id: number, baixar = false) => `${API}/notificacoes/anexos/${id}${baixar ? '?baixar=1' : ''}`;

/** Anexos de um aviso: imagens em miniatura (ampliam ao tocar), PDFs para abrir/baixar e links com cartão de prévia. */
export default function AvisoAnexos({ anexos }: { anexos: Anexo[] }) {
  const [zoom, setZoom] = useState<string | null>(null);
  if (!anexos?.length) return null;
  const imagens = anexos.filter((a) => a.tipo === 'arquivo' && a.mime?.startsWith('image/'));
  const pdfs = anexos.filter((a) => a.tipo === 'arquivo' && !a.mime?.startsWith('image/'));
  const links = anexos.filter((a) => a.tipo === 'link');
  return (
    <div className="mt-3 space-y-2.5">
      {imagens.length > 0 && (
        <ul className={`grid gap-2 ${imagens.length === 1 ? 'grid-cols-1 sm:max-w-[360px]' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {imagens.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setZoom(urlAnexo(a.id))} aria-label={`Ampliar ${a.nome ?? 'imagem'}`} className="block w-full overflow-hidden rounded-xl border border-line bg-sand">
                <img src={urlAnexo(a.id)} alt={a.nome ?? ''} loading="lazy" decoding="async" className={`w-full object-cover ${imagens.length === 1 ? 'max-h-[260px]' : 'aspect-[4/3]'}`} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {pdfs.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#fdf0ee] text-[#b3261e]"><FileText size={20} /></span>
          <span className="min-w-0 flex-1 leading-tight"><b className="block truncate text-[0.85rem]">{a.nome}</b><span className="text-[0.72rem] text-ink/50">PDF · {tam(a.tamanho)}</span></span>
          <a href={urlAnexo(a.id)} target="_blank" rel="noopener noreferrer" aria-label="Abrir PDF" title="Abrir" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink/70 hover:bg-ivory"><ExternalLink size={16} /></a>
          <a href={urlAnexo(a.id, true)} aria-label="Baixar PDF" title="Baixar" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink/70 hover:bg-ivory"><Download size={16} /></a>
        </div>
      ))}
      {links.map((a) => (
        <a key={a.id} href={a.url ?? '#'} target="_blank" rel="noopener noreferrer nofollow" className="flex overflow-hidden rounded-xl border border-line bg-white transition hover:border-gold-500/60 hover:bg-ivory">
          {a.imagem ? <img src={urlAnexo(a.id)} alt="" loading="lazy" decoding="async" className="h-auto w-[96px] shrink-0 object-cover sm:w-[132px]" /> : <span className="grid w-[64px] shrink-0 place-items-center bg-[#f6efe0] text-gold-600"><Link2 size={22} /></span>}
          <span className="min-w-0 flex-1 px-3 py-2.5 leading-snug">
            <span className="block text-[0.7rem] font-semibold uppercase tracking-wide text-gold-700">{a.site ?? 'Link'}</span>
            <b className="line-clamp-2 text-[0.88rem]">{a.titulo ?? a.url}</b>
            {a.descricao && <span className="mt-0.5 line-clamp-2 block text-[0.76rem] text-ink/60">{a.descricao}</span>}
          </span>
        </a>
      ))}
      {zoom && <Ampliada src={zoom} onFechar={() => setZoom(null)} />}
    </div>
  );
}

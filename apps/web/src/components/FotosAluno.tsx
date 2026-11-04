'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ImageIcon, Play } from 'lucide-react';
import { api, Atendimento, fmtData, fotoUrl } from '@/lib/api';
import { nomeLimpo } from '@/lib/session';
import { fmtDur } from '@/lib/midia';
import { Ampliada } from '@/components/Avatar';
import { FotoPerfil } from '@/components/CartaoAluno';
import MostrarMais from '@/components/MostrarMais';

type Pagina = { itens: Atendimento[]; proximo: string | null };
type Item = { id: number; created_at: string; paciente: string; cidade: string; video: boolean; dur?: number | null };
type Aluno = { id: number; nome: string; foto: string | null; matricula: string | null; cidade: string | null };

/** Fotos de um aluno em janela própria (a lista de alunos continua por trás), em grade paginada, com zoom e navegação entre as imagens. */
export default function FotosAluno({ aluno, titulo, subtitulo, filtro, onFechar }: { aluno?: Aluno; titulo?: string; subtitulo?: string; filtro?: string; onFechar: () => void }) {
  const consulta = filtro ?? `aluno_id=${aluno?.id}`;
  const nome = titulo ?? nomeLimpo(aluno?.nome ?? '');
  const [itens, setItens] = useState<Item[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [zoom, setZoom] = useState<number | null>(null);

  const carregar = useCallback(async (cursor: string | null) => {
    setCarregando(true);
    try {
      const r = await api<Pagina>(`/admin/atendimentos?${consulta}&limite=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      const novos = r.itens.flatMap((a) => a.fotos.filter((f) => !f.oculta).map((f) => ({ id: f.id, created_at: f.created_at, paciente: a.identificador_paciente, cidade: a.cidade, video: f.tipo === 'video', dur: f.duracao })));
      setItens((l) => { const ja = new Set(l.map((x) => x.id)); return [...l, ...novos.filter((x) => !ja.has(x.id))]; });
      setProximo(r.proximo);
      setErro('');
    } catch (e) { setErro((e as Error).message); } finally { setCarregando(false); }
  }, [consulta]);
  useEffect(() => { carregar(null); }, [carregar]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && zoom === null) onFechar(); };
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, [onFechar, zoom]);

  const atual = zoom !== null ? itens[zoom] : null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Fotos de ${nome}`} className="fade-in fixed inset-0 z-[100] flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={onFechar}>
      <div className="pop flex h-[94dvh] w-full max-w-[960px] flex-col overflow-hidden rounded-t-3xl bg-page shadow-2xl sm:h-[88vh] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3.5">
          <button type="button" onClick={onFechar} aria-label="Voltar para a lista" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-3.5 text-[0.82rem] font-semibold text-ink/80 transition hover:bg-ivory"><ArrowLeft size={16} />Voltar</button>
          {aluno && <FotoPerfil aluno={aluno} size={38} />}
          <div className="min-w-0 leading-tight"><p className="truncate text-[1rem] font-bold">{nome}</p><p className="truncate text-[0.74rem] text-ink/55">{subtitulo ?? [aluno?.matricula, aluno?.cidade].filter(Boolean).join(' · ')}{!subtitulo && itens.length ? ` · ${itens.length}${proximo ? '+' : ''} foto(s)` : ''}</p></div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {erro && <p role="alert" className="mb-3 rounded-xl bg-[#fdf0ee] px-3 py-2 text-[0.82rem] font-medium text-[#b3261e]">{erro}</p>}
          {carregando && itens.length === 0 && <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>{Array.from({ length: 8 }, (_, i) => <li key={i} className="aspect-square animate-pulse rounded-xl bg-sand" />)}</ul>}
          {!carregando && itens.length === 0 && !erro && <div className="px-4 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><ImageIcon size={22} /></span><p className="mt-3 font-semibold">Nenhuma foto para mostrar</p></div>}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {itens.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => setZoom(i)} aria-label={`Ampliar foto de ${p.paciente}`} className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-sand shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotoUrl(p.id, true)} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  {p.video && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.68rem] font-semibold text-white backdrop-blur-sm"><Play size={11} fill="currentColor" />{fmtDur(p.dur) || 'Vídeo'}</span>}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-8 text-left text-white"><span className="block truncate text-[0.78rem] font-semibold">{p.paciente}</span><span className="block truncate text-[0.68rem] text-white/80">{fmtData(p.created_at)}</span></span>
                </button>
              </li>
            ))}
          </ul>
          <MostrarMais auto temMais={!!proximo} carregando={carregando} onClick={() => carregar(proximo)} mostrados={itens.length} />
        </div>
      </div>
      {atual && <Ampliada video={atual.video} src={fotoUrl(atual.id)} onFechar={() => setZoom(null)} nav={{ atual: zoom as number, total: itens.length, ir: (i) => setZoom(i) }} />}
    </div>,
    document.body,
  );
}

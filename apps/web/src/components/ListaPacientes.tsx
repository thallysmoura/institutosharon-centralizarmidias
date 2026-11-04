'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, GraduationCap, ImageIcon, Search, Stethoscope, X } from 'lucide-react';
import { api, fotoUrl } from '@/lib/api';
import { fmtDia } from '@/lib/session';
import FotosAluno from '@/components/FotosAluno';

type Linha = { identificador: string; fotos: number; atendimentos: number; alunos: number; ultima: string; previas: { id: number }[] };
type Resposta = { itens: Linha[]; total: number; porPagina: number };
type Cid = { id: number; nome: string };

const MOSTRAR = 6; // miniaturas lado a lado em cada paciente

/** Pacientes: busca, cidade e ordenação no servidor (20 por página), com as primeiras fotos de cada paciente lado a lado e a janela com todas elas. */
export default function ListaPacientes({ cidades }: { cidades: Cid[] }) {
  const [q, setQ] = useState('');
  const [cidade, setCidade] = useState('');
  const [ordem, setOrdem] = useState<'recentes' | 'fotos' | 'atendimentos' | 'nome'>('recentes');
  const [pagina, setPagina] = useState(0);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ver, setVer] = useState<Linha | null>(null);
  const topo = useRef<HTMLDivElement>(null);
  const pedido = useRef(0);

  const buscar = useCallback((termo: string, cid: string, ord: string, pg: number) => {
    const n = ++pedido.current;
    setCarregando(true);
    api<Resposta>(`/admin/pacientes?q=${encodeURIComponent(termo.trim())}&cidade=${cid}&ordem=${ord}&pagina=${pg}`)
      .then((r) => { if (n === pedido.current) { setDados(r); setErro(''); } })
      .catch((e) => { if (n === pedido.current) setErro((e as Error).message); })
      .finally(() => { if (n === pedido.current) setCarregando(false); });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => buscar(q, cidade, ordem, pagina), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, cidade, ordem, pagina, buscar]);

  const filtrar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(0); };
  const irPagina = (p: number) => { setPagina(p); topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const total = dados?.total ?? 0;
  const por = dados?.porPagina ?? 20;
  const paginas = Math.max(1, Math.ceil(total / por));
  const filtrado = !!q.trim() || !!cidade;

  return (
    <section className="mt-6" aria-label="Pacientes">
      <div ref={topo} className="scroll-mt-4" />
      <div className="card grid gap-2.5 p-3.5 sm:grid-cols-[1fr_190px_190px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
          <input value={q} onChange={(e) => filtrar(setQ)(e.target.value)} placeholder="Buscar paciente pelo código ou nome" aria-label="Buscar paciente" className="field-plain !pl-9 !pr-9" />
          {q && <button type="button" onClick={() => filtrar(setQ)('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink/50 hover:bg-sand"><X size={15} /></button>}
        </div>
        <select value={cidade} onChange={(e) => filtrar(setCidade)(e.target.value)} aria-label="Cidade" className="field-plain">
          <option value="">Todas as cidades</option>
          {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={ordem} onChange={(e) => filtrar(setOrdem)(e.target.value as typeof ordem)} aria-label="Ordenar" className="field-plain">
          <option value="recentes">Último envio</option>
          <option value="fotos">Mais fotos</option>
          <option value="atendimentos">Mais atendimentos</option>
          <option value="nome">Nome (A-Z)</option>
        </select>
      </div>

      <p className="mt-3 text-[0.8rem] text-ink/55" aria-live="polite">{dados && total ? `${total.toLocaleString('pt-BR')} paciente(s)${filtrado ? ' encontrados' : ''}` : ' '}</p>
      {erro && <p role="alert" className="mt-2 rounded-xl bg-[#fdf0ee] px-3 py-2 text-[0.82rem] font-medium text-[#b3261e]">{erro}</p>}

      {!dados && carregando && <ul className="mt-2 space-y-2.5" aria-hidden>{Array.from({ length: 5 }, (_, i) => <li key={i} className="skeleton h-[132px]" />)}</ul>}
      {dados && total === 0 && !carregando && <div className="card mt-2 px-4 py-12 text-center"><p className="font-semibold">Nenhum paciente encontrado</p><p className="text-[0.85rem] text-ink/55">{filtrado ? 'Tente outra busca ou limpe os filtros.' : 'Os pacientes aparecem aqui assim que as fotos são enviadas.'}</p></div>}

      <ul className={`mt-2 space-y-2.5 transition-opacity ${carregando && dados ? 'opacity-55' : ''}`}>
        {dados?.itens.map((p) => {
          const resto = p.fotos - Math.min(p.previas.length, MOSTRAR);
          return (
            <li key={p.identificador} className="card p-3.5 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 leading-tight">
                  <h3 className="truncate text-[1.05rem] font-bold">{p.identificador}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[0.78rem] text-ink/60">
                    <span className="inline-flex items-center gap-1"><Stethoscope size={13} className="text-gold-600" />{p.atendimentos} atendimento(s)</span>
                    <span className="inline-flex items-center gap-1"><GraduationCap size={13} className="text-gold-600" />{p.alunos} aluno(s)</span>
                    <span className="inline-flex items-center gap-1"><CalendarClock size={13} className="text-gold-600" />Último envio em {fmtDia(p.ultima)}</span>
                  </p>
                </div>
                <span className="badge bg-[#f6efe0] text-gold-700"><ImageIcon size={13} />{p.fotos.toLocaleString('pt-BR')} foto(s)</span>
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="list" aria-label={`Prévia das fotos de ${p.identificador}`}>
                {p.previas.slice(0, MOSTRAR).map((f) => (
                  <button key={f.id} type="button" role="listitem" onClick={() => setVer(p)} aria-label={`Ver fotos de ${p.identificador}`} className="group relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-line transition hover:ring-gold-500 sm:h-[96px] sm:w-[96px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoUrl(f.id, true)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  </button>
                ))}
                {resto > 0 && (
                  <button type="button" role="listitem" onClick={() => setVer(p)} className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-xl bg-[#f6efe0] text-[0.9rem] font-bold text-gold-700 ring-1 ring-line transition hover:ring-gold-500 sm:h-[96px] sm:w-[96px]">+{resto}</button>
                )}
                {p.previas.length === 0 && <p className="py-3 text-[0.8rem] text-ink/50">Sem fotos disponíveis.</p>}
              </div>
            </li>
          );
        })}
      </ul>

      {total > por && (
        <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => irPagina(pagina - 1)} disabled={pagina === 0 || carregando} className="btn btn-line !min-h-[40px] !gap-1 !px-3.5 !text-[0.82rem]"><ChevronLeft size={16} />Anterior</button>
          <span className="text-[0.8rem] font-medium text-ink/65">Página {pagina + 1} de {paginas}</span>
          <button type="button" onClick={() => irPagina(pagina + 1)} disabled={pagina + 1 >= paginas || carregando} className="btn btn-line !min-h-[40px] !gap-1 !px-3.5 !text-[0.82rem]">Próxima<ChevronRight size={16} /></button>
        </nav>
      )}

      {ver && <FotosAluno titulo={ver.identificador} subtitulo={`${ver.fotos} foto(s) · ${ver.atendimentos} atendimento(s)`} filtro={`paciente=${encodeURIComponent(ver.identificador)}`} onFechar={() => setVer(null)} />}
    </section>
  );
}

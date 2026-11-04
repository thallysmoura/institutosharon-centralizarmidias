'use client';
import { useMemo, useState } from 'react';
import { CalendarClock, GraduationCap, ImageIcon, Images, MapPin, Search, Stethoscope, X } from 'lucide-react';
import { fmtDia } from '@/lib/session';

export type CidadeInfo = { id: number; nome: string; alunos: number; fotos: number; atendimentos?: number; ultimo?: string | null };

const n = (v: number) => v.toLocaleString('pt-BR');

/** Cidades: resumo geral, busca e ordenação, e um cartão por cidade com alunos, fotos, atendimentos, participação no total e acesso direto às fotos. */
export default function ListaCidades({ cidades, onVerFotos }: { cidades: CidadeInfo[]; onVerFotos: (id: number) => void }) {
  const [q, setQ] = useState('');
  const [ordem, setOrdem] = useState<'nome' | 'fotos' | 'alunos'>('nome');

  const totais = useMemo(() => ({ alunos: cidades.reduce((s, c) => s + c.alunos, 0), fotos: cidades.reduce((s, c) => s + c.fotos, 0), ativas: cidades.filter((c) => c.fotos > 0).length }), [cidades]);
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = cidades.filter((c) => !t || c.nome.toLowerCase().includes(t));
    return r.sort((a, b) => (ordem === 'fotos' ? b.fotos - a.fotos : ordem === 'alunos' ? b.alunos - a.alunos : 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [cidades, q, ordem]);

  const resumo: [typeof MapPin, string, string][] = [[MapPin, 'Cidades', `${cidades.length}${totais.ativas !== cidades.length ? ` (${totais.ativas} com envios)` : ''}`], [GraduationCap, 'Alunos', n(totais.alunos)], [ImageIcon, 'Fotos', n(totais.fotos)]];

  return (
    <section className="mt-6" aria-label="Cidades">
      <ul className="grid grid-cols-3 gap-2.5">
        {resumo.map(([Icone, t, v]) => (
          <li key={t} className="card flex flex-col items-start gap-1 p-3.5 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Icone size={19} strokeWidth={1.7} /></span>
            <span className="min-w-0 leading-tight"><span className="block text-[0.74rem] font-semibold text-ink/55">{t}</span><span className="block truncate text-[1.1rem] font-bold sm:text-[1.3rem]">{v}</span></span>
          </li>
        ))}
      </ul>

      {cidades.length > 4 && (
        <div className="card mt-3 grid gap-2.5 p-3 sm:grid-cols-[1fr_190px]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cidade" aria-label="Buscar cidade" className="field-plain !pl-9 !pr-9" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink/50 hover:bg-sand"><X size={15} /></button>}
          </div>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} aria-label="Ordenar" className="field-plain">
            <option value="nome">Nome (A-Z)</option>
            <option value="fotos">Mais fotos</option>
            <option value="alunos">Mais alunos</option>
          </select>
        </div>
      )}

      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((c) => {
          const pct = totais.fotos ? (c.fotos / totais.fotos) * 100 : 0;
          const vazia = c.fotos === 0;
          return (
            <li key={c.id} className="card flex flex-col p-4 transition hover:border-gold-500/50 hover:shadow-elevated sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}><MapPin size={20} strokeWidth={1.8} /></span>
                <div className="min-w-0 flex-1 leading-tight">
                  <h3 className="truncate text-[1.1rem] font-bold">{c.nome}</h3>
                  <span className={`badge mt-1 !px-2 !py-0.5 ${vazia ? 'badge-neutro' : 'badge-ok'}`}>{vazia ? 'Sem envios ainda' : 'Recebendo fotos'}</span>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {([[GraduationCap, c.alunos, 'Alunos'], [ImageIcon, c.fotos, 'Fotos'], [Stethoscope, c.atendimentos ?? 0, 'Atend.']] as const).map(([Icone, v, t]) => (
                  <div key={t} className="rounded-xl bg-[#faf6ec] px-1 py-2.5">
                    <dt className="flex items-center justify-center gap-1 text-[0.68rem] font-semibold text-ink/55"><Icone size={12} className="text-gold-600" />{t}</dt>
                    <dd className="mt-0.5 text-[1.15rem] font-bold leading-none">{n(v)}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4">
                <div className="flex items-baseline justify-between text-[0.74rem] text-ink/55"><span>Participação nas fotos</span><b className="text-ink/80">{pct < 1 && pct > 0 ? '<1' : Math.round(pct)}%</b></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f1ece1]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Participação de ${c.nome}`}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%`, background: 'linear-gradient(90deg,#d9b655,#a67c26)' }} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 pt-1">
                <p className="flex min-w-0 items-center gap-1.5 text-[0.74rem] text-ink/55"><CalendarClock size={13} className="shrink-0 text-gold-600" /><span className="truncate">{c.ultimo ? `Último envio em ${fmtDia(c.ultimo)}` : 'Nenhum envio ainda'}</span></p>
                <button type="button" onClick={() => onVerFotos(c.id)} disabled={vazia} className="btn btn-line !min-h-[38px] !shrink-0 !gap-1.5 !rounded-lg !px-3 !text-[0.78rem]"><Images size={14} />Ver fotos</button>
              </div>
            </li>
          );
        })}
        {lista.length === 0 && <li className="card px-4 py-10 text-center text-[0.88rem] text-ink/55 sm:col-span-2 xl:col-span-3">{cidades.length ? 'Nenhuma cidade encontrada.' : 'Nenhuma cidade cadastrada.'}</li>}
      </ul>
    </section>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Camera, Clock, FileSpreadsheet, GraduationCap, ImageIcon, MapPin, Minus, Smartphone, Trash2, Trophy, Users } from 'lucide-react';
import { API, api, Atendimento, fmtData } from '@/lib/api';
import { nomeLimpo } from '@/lib/session';
import Titulo from './Titulo';
import Spinner from './Spinner';
import { BarrasH, GraficoDias, GraficoHoras, Rosca } from './Graficos';

type Painel = {
  dias: number;
  kpi: { fotos: number; atendimentos: number; pacientes: number; alunos: number; cidades: number; ocultas: number; bytes: string; fotos_hoje: number; fotos_periodo: number; fotos_anterior: number; atend_periodo: number; atend_anterior: number; alunos_ativos: number };
  porDia: { dia: string; fotos: number; atendimentos: number }[];
  porCidade: { cidade: string; fotos: number; atendimentos: number; alunos: number }[];
  topAlunos: { id: number; nome: string; matricula: string | null; cidade: string | null; fotos: number; atendimentos: number }[];
  dispositivos: { nome: string; n: number }[];
  porHora: { hora: number; fotos: number }[];
};

const PERIODOS: [number, string][] = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [365, '12 meses']];
const num = (n: number) => n.toLocaleString('pt-BR');
const mb = (b: string) => { const n = Number(b); return n >= 1073741824 ? `${(n / 1073741824).toFixed(2)} GB` : `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`; };

/** Variação percentual contra o período anterior de mesmo tamanho. */
function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  if (!anterior && !atual) return <span className="inline-flex items-center gap-0.5 text-[0.72rem] font-semibold text-ink/40"><Minus size={13} />sem dados</span>;
  if (!anterior) return <span className="inline-flex items-center gap-0.5 text-[0.72rem] font-semibold text-[#17794a]"><ArrowUpRight size={14} />novo</span>;
  const p = Math.round(((atual - anterior) / anterior) * 100);
  if (p === 0) return <span className="inline-flex items-center gap-0.5 text-[0.72rem] font-semibold text-ink/50"><Minus size={13} />estável</span>;
  const sobe = p > 0;
  return <span className={`inline-flex items-center gap-0.5 text-[0.72rem] font-semibold ${sobe ? 'text-[#17794a]' : 'text-[#b3261e]'}`}>{sobe ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(p)}%</span>;
}

function Kpi({ icone: Icone, rotulo, valor, sub, extra, tom = 'ouro', onClick }: { icone: typeof Camera; rotulo: string; valor: string; sub?: string; extra?: React.ReactNode; tom?: 'ouro' | 'vermelho'; onClick?: () => void }) {
  const cor = tom === 'vermelho' ? 'bg-[#fdf0ee] text-[#b3261e]' : 'bg-[#f6efe0] text-gold-600';
  const conteudo = (
    <>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${cor}`}><Icone size={19} strokeWidth={1.7} /></span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-ink/55">{rotulo}</span>
        <span className="mt-0.5 block text-[1.55rem] font-bold text-[#33240F]">{valor}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.72rem] text-ink/55">{extra}{sub}</span>
      </span>
    </>
  );
  const cls = 'card flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft';
  return onClick ? <button type="button" onClick={onClick} className={cls}>{conteudo}</button> : <div className={cls}>{conteudo}</div>;
}

function Bloco({ icone, titulo, children, className = '' }: { icone: typeof Camera; titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-4 sm:p-5 ${className}`}>
      <Titulo nivel={3} icone={icone}>{titulo}</Titulo>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Visão geral do gestor: indicadores com variação, gráficos do período, ranking, atividade recente e exportação para Excel. */
export default function VisaoGeral({ recentes, irPara, abrir }: { recentes: Atendimento[]; irPara: (v: 'fotos' | 'exclusoes') => void; abrir: (a: Atendimento) => void }) {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState<Painel | null>(null);
  const [erro, setErro] = useState('');
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback((n: number) => { setErro(''); return api<Painel>(`/admin/dashboard?dias=${n}`).then(setD).catch((e) => setErro((e as Error).message)); }, []);
  useEffect(() => { carregar(dias); }, [dias, carregar]);

  async function exportar() {
    setExportando(true);
    try {
      const r = await fetch(`${API}/admin/exportar?dias=${dias}`, { credentials: 'include' });
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `fotos-clinicas-sharon-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { setErro('Não foi possível gerar a planilha. Tente novamente.'); } finally { setExportando(false); }
  }

  const k = d?.kpi;
  const rotuloPeriodo = PERIODOS.find((p) => p[0] === dias)![1];

  return (
    <div className="mt-5 space-y-4 sm:mt-6 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Período" className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-white p-1">
          {PERIODOS.map(([n, r]) => (
            <button key={n} type="button" role="tab" aria-selected={dias === n} onClick={() => setDias(n)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-[0.82rem] font-semibold transition ${dias === n ? 'text-white shadow-sm' : 'text-ink/65 hover:bg-ivory'}`}
              style={dias === n ? { background: 'linear-gradient(180deg,#c9a24a,#a67c26)' } : undefined}>{r}</button>
          ))}
        </div>
        <button type="button" onClick={exportar} disabled={exportando} className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 text-[0.85rem] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(23,121,74,.8)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-70" style={{ background: 'linear-gradient(180deg,#22a35a,#17794a)' }}>
          {exportando ? <Spinner size={16} /> : <FileSpreadsheet size={17} />}Exportar Excel
        </button>
      </div>

      {erro && <p role="alert" className="rounded-xl bg-[#fdf0ee] px-4 py-3 text-[0.85rem] font-medium text-[#b3261e]">{erro}</p>}

      {!d && !erro && (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3" aria-hidden>{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="card h-[104px] animate-pulse !bg-sand" />)}</div>
      )}

      {d && k && (
        <>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <Kpi icone={ImageIcon} rotulo={`Fotos · ${rotuloPeriodo}`} valor={num(k.fotos_periodo)} extra={<Delta atual={k.fotos_periodo} anterior={k.fotos_anterior} />} sub={`${num(k.fotos)} no total`} />
            <Kpi icone={Activity} rotulo={`Atendimentos · ${rotuloPeriodo}`} valor={num(k.atend_periodo)} extra={<Delta atual={k.atend_periodo} anterior={k.atend_anterior} />} sub={`${num(k.atendimentos)} no total`} />
            <Kpi icone={GraduationCap} rotulo="Alunos ativos" valor={num(k.alunos_ativos)} sub={`de ${num(k.alunos)} cadastrados`} />
            <Kpi icone={Users} rotulo="Pacientes" valor={num(k.pacientes)} sub={`${num(k.cidades)} cidade(s)`} />
            <Kpi icone={Camera} rotulo="Fotos hoje" valor={num(k.fotos_hoje)} sub={`${mb(k.bytes)} armazenados`} />
            <Kpi icone={Trash2} tom={k.ocultas ? 'vermelho' : 'ouro'} rotulo="Excluídas por alunos" valor={num(k.ocultas)} sub={k.ocultas ? 'aguardando decisão' : 'nenhuma pendente'} onClick={() => irPara('exclusoes')} />
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            <Bloco icone={BarChart3} titulo={`Envios por dia · ${rotuloPeriodo}`} className="lg:col-span-2"><GraficoDias dados={d.porDia} /></Bloco>
            <Bloco icone={Smartphone} titulo="Dispositivos"><Rosca itens={d.dispositivos} /></Bloco>
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            <Bloco icone={MapPin} titulo="Fotos por cidade"><BarrasH itens={d.porCidade.map((c) => ({ rotulo: c.cidade, valor: c.fotos, sub: `${num(c.atendimentos)} atendimento(s) · ${num(c.alunos)} aluno(s)` }))} /></Bloco>
            <Bloco icone={Trophy} titulo="Ranking de alunos"><BarrasH itens={d.topAlunos.map((a) => ({ rotulo: nomeLimpo(a.nome), valor: a.fotos, sub: `${a.matricula ?? 'sem matrícula'}${a.cidade ? ` · ${a.cidade}` : ''} · ${num(a.atendimentos)} atendimento(s)` }))} /></Bloco>
            <Bloco icone={Clock} titulo="Horário de maior movimento" className="lg:col-span-2 2xl:col-span-1"><GraficoHoras dados={d.porHora} /></Bloco>
          </div>

          <Bloco icone={Activity} titulo="Últimos atendimentos">
            {recentes.length === 0 ? <p className="py-4 text-center text-[0.85rem] text-ink/50">Nenhum atendimento recebido ainda.</p> : (
              <ul className="divide-y divide-line">
                {recentes.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => abrir(a)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-ivory sm:px-2">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Camera size={18} strokeWidth={1.7} /></span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[0.92rem] font-semibold">{a.identificador_paciente}</span>
                        <span className="block truncate text-[0.76rem] text-ink/55">{nomeLimpo(a.aluno.nome)} · {a.cidade}</span>
                      </span>
                      <span className="shrink-0 text-right text-[0.74rem] leading-tight text-ink/55"><b className="block text-[0.82rem] text-ink">{a.fotos.length} foto(s)</b>{fmtData(a.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => irPara('fotos')} className="mt-3 text-[0.85rem] font-semibold text-gold-700 underline underline-offset-2">Ver todas as fotos</button>
          </Bloco>
        </>
      )}
    </div>
  );
}

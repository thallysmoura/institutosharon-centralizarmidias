'use client';
import { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, Calendar, Camera, ChevronRight, Clock, Download, GraduationCap, ImageIcon, MapPin, Smartphone, Trash2, User, Users } from 'lucide-react';
import { API, api, Atendimento, fmtData, fotoUrl } from '@/lib/api';
import { nomeLimpo } from '@/lib/session';
import Titulo from './Titulo';
import Spinner from './Spinner';
import { GraficoDias, GraficoHoras } from './Graficos';

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
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const mb = (b: string) => { const n = Number(b); return n >= 1073741824 ? `${(n / 1073741824).toFixed(2)} GB` : `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`; };

/** Variação percentual contra o período anterior de mesmo tamanho, em formato de selo. */
function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  if (!anterior && !atual) return null;
  if (!anterior) return <span className="inline-flex items-center gap-0.5 rounded-full bg-[#e7f6ee] px-2 py-0.5 text-[0.7rem] font-bold text-[#17794a]">novo</span>;
  const p = Math.round(((atual - anterior) / anterior) * 100);
  if (p === 0) return <span className="inline-flex items-center rounded-full bg-sand px-2 py-0.5 text-[0.7rem] font-bold text-ink/55">— 0%</span>;
  return <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${p > 0 ? 'bg-[#e7f6ee] text-[#17794a]' : 'bg-[#fdf0ee] text-[#b3261e]'}`}>{p > 0 ? '↑ +' : '↓ '}{p}%</span>;
}

const CARTAO = 'rounded-2xl border border-[#efe6d2] bg-gradient-to-b from-white to-[#fdfaf3] shadow-[0_14px_34px_-22px_rgba(120,80,10,.45)]';

function Kpi({ icone: Icone, rotulo, valor, sub, extra, tom = 'ouro', onClick }: { icone: typeof Camera; rotulo: string; valor: string; sub?: string; extra?: React.ReactNode; tom?: 'ouro' | 'vermelho'; onClick?: () => void }) {
  const cor = tom === 'vermelho' ? 'bg-[#fdf0ee] text-[#b3261e]' : 'bg-[#f7ecd3] text-gold-600';
  const conteudo = (
    <>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${cor}`}><Icone size={22} strokeWidth={1.6} /></span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="line-clamp-2 text-[0.7rem] font-bold uppercase leading-[1.25] tracking-[0.05em] text-ink/60">{rotulo}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[1.85rem] font-extrabold leading-none tracking-[-0.02em] text-[#33240F] tabular-nums">{valor}</span>{extra}</span>
        {sub && <span className="mt-1.5 block truncate text-[0.74rem] text-ink/55">{sub}</span>}
      </span>
    </>
  );
  const cls = `${CARTAO} flex items-center gap-3 p-3.5 text-left transition hover:-translate-y-0.5 sm:p-4`;
  return onClick ? <button type="button" onClick={onClick} className={cls}>{conteudo}</button> : <div className={cls}>{conteudo}</div>;
}

function Bloco({ icone: Icone, titulo, sub, children, className = '', acao }: { icone: typeof Camera; titulo: string; sub?: string; children: React.ReactNode; className?: string; acao?: React.ReactNode }) {
  return (
    <section className={`${CARTAO} min-w-0 p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f7ecd3] text-gold-600"><Icone size={20} strokeWidth={1.7} /></span><div className="min-w-0 leading-tight"><h3 className="truncate text-[1.1rem] font-bold tracking-[-0.01em] text-[#33240F]">{titulo}</h3>{sub && <p className="truncate text-[0.74rem] text-ink/55">{sub}</p>}</div></div>
        {acao}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type Presenca = { id: number; estado: 'online' | 'ausente' | 'offline' };

/** Anel de dispositivos por situação (online, ausente, offline), com o total conectado no centro. */
function AnelDispositivos({ pres }: { pres: Presenca[] }) {
  const n = { online: 0, ausente: 0, offline: 0 };
  pres.forEach((p) => { n[p.estado]++; });
  const total = pres.length;
  const R = 54, C = 2 * Math.PI * R;
  const itens: [string, number, string][] = [['Online', n.online, '#3aa56b'], ['Ausentes', n.ausente, '#e7b23c'], ['Offline', n.offline, '#b9b0a0']];
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-around">
      <svg viewBox="0 0 150 150" className="h-[150px] w-[150px] shrink-0" role="img" aria-label="Dispositivos por situação">
        <defs><linearGradient id="anel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e7b23c" /><stop offset="1" stopColor="#a67c26" /></linearGradient></defs>
        <circle cx="75" cy="75" r={R} fill="none" stroke="#f1ece1" strokeWidth="16" />
        {total === 0 ? null : itens.map(([nome, v, cor]) => {
          const len = (v / total) * C;
          const el = v ? <circle key={nome} cx="75" cy="75" r={R} fill="none" stroke={nome === 'Online' ? 'url(#anel)' : cor} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 75 75)" /> : null;
          acc += len;
          return el;
        })}
        <text x="75" y="76" textAnchor="middle" fontSize="30" fontWeight="700" fill="#33240F">{n.online + n.ausente}</text>
        <text x="75" y="95" textAnchor="middle" fontSize="11" fill="#8a7a62">conectados</text>
      </svg>
      <ul className="w-full max-w-[220px] space-y-3 text-[0.9rem]">
        {itens.map(([nome, v, cor]) => <li key={nome} className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} /><span className="flex-1 font-semibold"><b>{v}</b> {nome.toLowerCase()}</span></li>)}
      </ul>
    </div>
  );
}


/** Visão geral do gestor: indicadores com variação, gráficos do período, alunos mais ativos, atividade recente e exportação para Excel. */
export default function VisaoGeral({ recentes, irPara, abrir }: { recentes: Atendimento[]; irPara: (v: 'fotos' | 'exclusoes') => void; abrir: (a: Atendimento) => void }) {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState<Painel | null>(null);
  const [pres, setPres] = useState<Presenca[]>([]);
  const [erro, setErro] = useState('');
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback((n: number) => {
    setErro('');
    api<Presenca[]>('/admin/presenca').then(setPres).catch(() => null);
    return api<Painel>(`/admin/dashboard?dias=${n}`).then(setD).catch((e) => setErro((e as Error).message));
  }, []);
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
  const maxCidade = Math.max(1, ...(d?.porCidade.map((c) => c.fotos) ?? [1]));
  const totalFotosCidades = d?.porCidade.reduce((t, c) => t + c.fotos, 0) ?? 0;
  const cidadeLider = d?.porCidade[0] && d.porCidade[0].fotos > 0 ? d.porCidade[0] : null;
  const picoHora = d?.porHora.length ? d.porHora.reduce((a, b) => (b.fotos > a.fotos ? b : a), d.porHora[0]) : null;
  const alunoTop = d?.topAlunos[0] && d.topAlunos[0].fotos > 0 ? d.topAlunos[0] : null;

  return (
    <div className="mt-5 space-y-4 sm:mt-6 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Período" className="inline-flex max-w-full overflow-x-auto rounded-xl border border-[#efe6d2] bg-white p-1 shadow-sm">
          {PERIODOS.map(([n, r]) => (
            <button key={n} type="button" role="tab" aria-selected={dias === n} onClick={() => setDias(n)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-[0.84rem] font-semibold transition ${dias === n ? 'text-white shadow-sm' : 'text-ink/70 hover:bg-ivory'}`}
              style={dias === n ? { background: 'linear-gradient(180deg,#d9b04e,#a67c26)' } : undefined}>{r}</button>
          ))}
        </div>
        <button type="button" onClick={exportar} disabled={exportando} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 text-[0.88rem] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(150,100,10,.8)] transition hover:brightness-105 disabled:opacity-70" style={{ background: 'linear-gradient(180deg,#d9b04e,#a67c26)' }}>
          {exportando ? <Spinner size={16} /> : <Download size={18} />}Exportar Excel
        </button>
      </div>

      {erro && <p role="alert" className="rounded-xl bg-[#fdf0ee] px-4 py-3 text-[0.85rem] font-medium text-[#b3261e]">{erro}</p>}

      {!d && !erro && (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-5" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <div key={i} className={`${CARTAO} h-[100px] animate-pulse !bg-sand`} />)}</div>
      )}

      {d && k && (
        <>
          {k.ocultas > 0 && (
            <button type="button" onClick={() => irPara('exclusoes')} className="flex w-full items-center gap-3 rounded-2xl border border-[#f0cfc9] bg-[#fdf0ee] px-4 py-3 text-left transition hover:brightness-[.98]">
              <Trash2 size={20} className="shrink-0 text-[#b3261e]" aria-hidden />
              <span className="flex-1 text-[0.9rem] leading-snug text-[#7a1c15]"><b>{num(k.ocultas)} foto(s) excluída(s) por alunos</b> aguardam a sua decisão (restaurar ou excluir em definitivo).</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[0.82rem] font-bold text-[#b3261e]">Revisar<ChevronRight size={16} /></span>
            </button>
          )}

          <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Kpi icone={ImageIcon} rotulo="Fotos recebidas" valor={num(k.fotos_periodo)} extra={<Delta atual={k.fotos_periodo} anterior={k.fotos_anterior} />} sub={`${rotuloPeriodo} · vs. período anterior`} />
            <Kpi icone={Activity} rotulo="Atendimentos" valor={num(k.atend_periodo)} extra={<Delta atual={k.atend_periodo} anterior={k.atend_anterior} />} sub={`${rotuloPeriodo} · vs. período anterior`} />
            <Kpi icone={GraduationCap} rotulo="Alunos ativos" valor={num(k.alunos_ativos)} extra={k.alunos ? <span className="rounded-full bg-[#f7ecd3] px-2 py-0.5 text-[0.7rem] font-bold text-gold-700">{pct(k.alunos_ativos, k.alunos)}% da base</span> : undefined} sub={`de ${num(k.alunos)} alunos cadastrados`} />
            <Kpi icone={Users} rotulo="Pacientes atendidos" valor={num(k.pacientes)} sub={`em ${num(k.cidades)} unidade(s)`} />
            <Kpi icone={Camera} rotulo="Fotos por atendimento" valor={k.atend_periodo ? (k.fotos_periodo / k.atend_periodo).toFixed(1).replace('.', ',') : '0'} sub="média no período" />
          </div>

          {(cidadeLider || (picoHora && picoHora.fotos > 0) || alunoTop) && (
            <section aria-label="Destaques do período" className="grid gap-px overflow-hidden rounded-2xl border border-[#e3d3a8] bg-[#e3d3a8] shadow-[0_14px_34px_-22px_rgba(120,80,10,.45)] sm:grid-cols-3">
              {([
                ['Unidade com maior volume', cidadeLider ? cidadeLider.cidade : '', cidadeLider ? `${pct(cidadeLider.fotos, totalFotosCidades)}% das fotos do período (${num(cidadeLider.fotos)})` : '', MapPin],
                ['Horário de pico', picoHora && picoHora.fotos > 0 ? `${picoHora.hora}h às ${picoHora.hora + 1}h` : '', picoHora && picoHora.fotos > 0 ? `${num(picoHora.fotos)} fotos recebidas nessa faixa` : '', Clock],
                ['Aluno mais ativo', alunoTop ? nomeLimpo(alunoTop.nome) : '', alunoTop ? `${num(alunoTop.fotos)} fotos em ${num(alunoTop.atendimentos)} atendimento(s)` : '', GraduationCap],
              ] as const).map(([t, v, sub, Icone]) => (
                <div key={t} className="flex items-center gap-3 bg-gradient-to-b from-[#fffaf0] to-[#fbf1d8] px-4 py-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 text-gold-600"><Icone size={20} strokeWidth={1.7} /></span>
                  <div className="min-w-0 leading-tight">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-gold-700">{t}</p>
                    <p className="mt-0.5 truncate text-[1.1rem] font-extrabold text-[#33240F]">{v || '-'}</p>
                    <p className="truncate text-[0.74rem] text-ink/60">{sub || 'Sem dados no período'}</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          <div className="grid gap-4 sm:gap-5 xl:grid-cols-3">
            <Bloco icone={BarChart3} titulo="Evolução dos envios" sub={`Fotos e atendimentos por dia · ${rotuloPeriodo}`} className="xl:col-span-2"><GraficoDias dados={d.porDia} /></Bloco>
            <Bloco icone={Smartphone} titulo="Dispositivos conectados" sub="Situação dos acessos agora"><AnelDispositivos pres={pres} /></Bloco>
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            <Bloco icone={MapPin} titulo="Volume por unidade" sub="Participação nas fotos do período">
              {d.porCidade.length === 0 ? <p className="py-4 text-center text-[0.85rem] text-ink/50">Sem dados no período.</p> : (
                <ul className="space-y-4">
                  {d.porCidade.slice(0, 6).map((c, i) => (
                    <li key={c.cidade} className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.78rem] font-bold text-white" style={{ background: 'linear-gradient(180deg,#e0bd63,#b98a2c)' }}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3 text-[0.9rem]"><b className="truncate">{c.cidade}</b><span className="shrink-0 text-ink/70"><b className="text-[#33240F] tabular-nums">{num(c.fotos)}</b> fotos · {pct(c.fotos, totalFotosCidades)}%</span></div>
                        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#f1ece1]"><div className="grow-bar h-full rounded-full" style={{ width: `${(c.fotos / maxCidade) * 100}%`, background: 'linear-gradient(90deg,#d9b04e,#a67c26)' }} /></div>
                        <p className="mt-1 text-[0.72rem] text-ink/50">{num(c.atendimentos)} atendimento(s) · {num(c.alunos)} aluno(s)</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>
            <Bloco icone={Users} titulo="Alunos mais ativos" sub="Maior volume de fotos enviadas no período">
              {d.topAlunos.length === 0 ? <p className="py-4 text-center text-[0.85rem] text-ink/50">Sem dados no período.</p> : (
                <ul className="divide-y divide-[#efe6d2]">
                  {d.topAlunos.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.9rem] font-bold text-white" style={{ background: 'linear-gradient(180deg,#e7b23c,#c9a24a)' }}>{nomeLimpo(a.nome).charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[0.92rem] font-semibold">{nomeLimpo(a.nome)}</span><span className="block truncate text-[0.72rem] text-ink/50">{a.cidade ?? 'Sem unidade'} · {num(a.atendimentos)} atendimento(s)</span></span>
                      <b className="shrink-0 text-[0.92rem] tabular-nums">{num(a.fotos)} <span className="text-[0.74rem] font-medium text-ink/55">fotos</span></b>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>
            <Bloco icone={Clock} titulo="Horários de maior movimento" sub="Fotos recebidas por hora do dia" className="lg:col-span-2 2xl:col-span-1"><GraficoHoras dados={d.porHora} /></Bloco>
          </div>

          <Bloco icone={Activity} titulo="Atendimentos recentes" sub="Últimos registros recebidos" acao={<button type="button" onClick={() => irPara('fotos')} className="inline-flex shrink-0 items-center gap-1 text-[0.85rem] font-semibold text-gold-700 underline underline-offset-2">Ver todos<ChevronRight size={15} /></button>}>
            {recentes.length === 0 ? <p className="py-4 text-center text-[0.85rem] text-ink/50">Nenhum atendimento recebido ainda.</p> : (
              <>
                <div className="hidden grid-cols-[3rem_1.1fr_1.3fr_1fr_1fr_5.5rem_1.2rem] gap-x-4 border-b border-[#efe6d2] px-2 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ink/45 lg:grid"><span /><span>Paciente</span><span>Data e hora</span><span>Aluno</span><span>Unidade</span><span>Fotos</span><span /></div>
                <ul className="divide-y divide-[#efe6d2]">
                  {recentes.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => abrir(a)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 py-3 text-left transition hover:bg-ivory sm:px-2 lg:grid-cols-[3rem_1.1fr_1.3fr_1fr_1fr_5.5rem_1.2rem]">
                        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f7ecd3] text-gold-600">
                          {a.fotos[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={fotoUrl(a.fotos[0].id, true)} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <Camera size={18} />}
                        </span>
                        <span className="min-w-0 leading-tight"><span className="block truncate text-[0.95rem] font-bold">{a.identificador_paciente}</span><span className="block truncate text-[0.74rem] text-ink/55 lg:hidden">{nomeLimpo(a.aluno.nome)} · {a.cidade} · {fmtData(a.created_at)}</span></span>
                        <span className="hidden items-center gap-1.5 text-[0.82rem] text-ink/70 lg:flex"><Calendar size={15} className="shrink-0 text-ink/45" />{fmtData(a.created_at)}</span>
                        <span className="hidden min-w-0 items-center gap-1.5 truncate text-[0.82rem] text-ink/70 lg:flex"><User size={15} className="shrink-0 text-ink/45" />{nomeLimpo(a.aluno.nome)}</span>
                        <span className="hidden min-w-0 items-center gap-1.5 truncate text-[0.82rem] text-ink/70 lg:flex"><MapPin size={15} className="shrink-0 text-ink/45" />{a.cidade}</span>
                        <span className="inline-flex shrink-0 items-center justify-self-start rounded-full bg-[#e7f6ee] px-3 py-1 text-[0.76rem] font-bold text-[#17794a]">{a.fotos.length} foto(s)</span>
                        <ChevronRight size={18} className="hidden text-ink/40 lg:block" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Bloco>
        </>
      )}
    </div>
  );
}

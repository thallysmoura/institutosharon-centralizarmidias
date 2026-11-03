'use client';
import { useCallback, useEffect, useState } from 'react';
import { Bell, Download, Eye, GraduationCap, HardDrive, House, ImageIcon, LogOut, MapPin, ShieldCheck, Users } from 'lucide-react';
import { api, Atendimento, fotoUrl, fmtData, Me } from '@/lib/api';
import { fmtDia, nomeLimpo, useSession } from '@/lib/session';
import { Wordmark } from '@/components/Brand';
import Armazenamento from '@/components/Armazenamento';
import PageLoader from '@/components/PageLoader';
import ControleAcesso from '@/components/ControleAcesso';

type Vista = 'geral' | 'fotos' | 'alunos' | 'pacientes' | 'cidades' | 'armazenamento' | 'acessos';
type Resumo = { fotos: number; pacientes: number; alunos: number; cidades: number; pendentes: number };
type Cidade = { id: number; nome: string; alunos: number; fotos: number };
type Aluno = { id: number; nome: string; matricula: string | null; cidade: string | null; atendimentos: number; fotos: number };
type Paciente = { identificador: string; alunos: number; fotos: number; ultima: string };
type Filtros = { cidade: string; aluno_id: string; q: string; de: string; ate: string };
const VAZIO: Filtros = { cidade: '', aluno_id: '', q: '', de: '', ate: '' };

const NAV: [Vista, string, typeof House][] = [
  ['geral', 'Visão Geral', House],
  ['fotos', 'Fotos', ImageIcon],
  ['alunos', 'Alunos', GraduationCap],
  ['pacientes', 'Pacientes', Users],
  ['cidades', 'Cidades', MapPin],
  ['acessos', 'Controle de Acesso', ShieldCheck],
  ['armazenamento', 'Armazenamento', HardDrive],
];
const num = (n: number | undefined) => (n ?? 0).toLocaleString('pt-BR');

function baixar(a: Atendimento) {
  a.fotos.forEach((f, i) =>
    setTimeout(() => {
      const l = document.createElement('a');
      l.href = `${fotoUrl(f.id)}?download=1`;
      l.download = '';
      document.body.appendChild(l);
      l.click();
      l.remove();
    }, i * 450),
  );
}

function Painel({ me, sair }: { me: Me; sair: () => void }) {
  const [vista, setVista] = useState<Vista>('geral');
  const [f, setF] = useState<Filtros>(VAZIO);
  const [resumo, setResumo] = useState<Resumo>();
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [lista, setLista] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberta, setAberta] = useState<{ a: Atendimento; i: number } | null>(null);

  useEffect(() => {
    api<Resumo>('/admin/resumo').then(setResumo).catch(() => null);
    api<Cidade[]>('/admin/cidades').then(setCidades).catch(() => null);
    api<Aluno[]>('/admin/alunos').then(setAlunos).catch(() => null);
    api<Paciente[]>('/admin/pacientes').then(setPacientes).catch(() => null);
  }, []);

  const buscar = useCallback(async (filtros: Filtros) => {
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
    try { setLista(await api<Atendimento[]>(`/admin/atendimentos?${qs}`)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => buscar(f), 200); return () => clearTimeout(t); }, [f, buscar]);

  useEffect(() => {
    if (!aberta) return;
    const n = aberta.a.fotos.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberta(null);
      if (e.key === 'ArrowRight') setAberta({ a: aberta.a, i: (aberta.i + 1) % n });
      if (e.key === 'ArrowLeft') setAberta({ a: aberta.a, i: (aberta.i - 1 + n) % n });
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [aberta]);

  const set = (k: keyof Filtros) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const irFotos = (parcial: Partial<Filtros>) => { setF({ ...VAZIO, ...parcial }); setVista('fotos'); };

  const stats: [string, number | undefined, typeof House][] = [
    ['Fotos recebidas', resumo?.fotos, ImageIcon], ['Pacientes', resumo?.pacientes, Users], ['Alunos', resumo?.alunos, GraduationCap], ['Cidades', resumo?.cidades, MapPin],
  ];

  const tabela = (
    <>
      <h2 className="text-[1.6rem] font-bold">Fotos dos Atendimentos</h2>
      <div className="card mt-3 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-[0.78rem] font-semibold text-ink/70">Cidade
          <select value={f.cidade} onChange={set('cidade')} className="field-plain mt-1"><option value="">Todas</option>{cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </label>
        <label className="text-[0.78rem] font-semibold text-ink/70">Aluno
          <select value={f.aluno_id} onChange={set('aluno_id')} className="field-plain mt-1"><option value="">Todos</option>{alunos.map((a) => <option key={a.id} value={a.id}>{nomeLimpo(a.nome)}{a.matricula ? ` (${a.matricula})` : ''}</option>)}</select>
        </label>
        <label className="text-[0.78rem] font-semibold text-ink/70">Paciente
          <select value={f.q} onChange={set('q')} className="field-plain mt-1"><option value="">Todos</option>{pacientes.map((p) => <option key={p.identificador} value={p.identificador}>{p.identificador}</option>)}</select>
        </label>
        <div className="text-[0.78rem] font-semibold text-ink/70">Período
          <div className="mt-1 flex items-center gap-1.5">
            <input type="date" aria-label="De" value={f.de} onChange={set('de')} className="field-plain min-w-0 flex-1 !px-2" />
            <input type="date" aria-label="Até" value={f.ate} onChange={set('ate')} className="field-plain min-w-0 flex-1 !px-2" />
          </div>
        </div>
      </div>

      <div className="card mt-4 overflow-hidden !p-0">
      <div className="hidden grid-cols-[130px_90px_1.3fr_1fr_100px_auto] items-center gap-4 border-b border-line bg-[#f3efe7] px-4 py-3 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-ink/70 lg:grid">
        <span>Prévia</span><span>Paciente</span><span>Aluno (Matrícula)</span><span>Cidade</span><span>Data</span><span className="text-right">Ações</span>
      </div>
      {loading && lista.length === 0 && <div className="space-y-3 p-4" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-sand" />)}</div>}
      {!loading && lista.length === 0 && <div className="px-4 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><ImageIcon size={22} /></span><p className="mt-3 font-semibold">Nenhum atendimento encontrado</p><p className="text-[0.85rem] text-ink/55">Ajuste os filtros para ampliar a busca.</p></div>}
      <ul className={loading ? 'opacity-60 transition' : 'transition'}>
        {lista.map((a) => (
          <li key={a.id} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 transition last:border-b-0 hover:bg-ivory lg:grid-cols-[130px_90px_1.3fr_1fr_100px_auto]">
            <button type="button" onClick={() => setAberta({ a, i: 0 })} aria-label="Visualizar fotos" className="flex overflow-hidden rounded-lg bg-sand">
              {a.fotos.slice(0, 2).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={fotoUrl(p.id, true)} alt="" loading="lazy" className="h-14 w-14 object-cover lg:h-[52px] lg:w-[52px]" />
              ))}
            </button>
            <div className="contents lg:contents">
              <span className="font-bold">{a.identificador_paciente}</span>
              <span className="col-span-2 text-[0.82rem] leading-tight lg:col-span-1">{nomeLimpo(a.aluno.nome)}<br /><span className="text-ink/60">({a.aluno.matricula ?? 'sem matrícula'})</span></span>
              <span className="flex items-center gap-1.5 text-[0.85rem]"><MapPin size={15} className="text-gold-500" />{a.cidade}</span>
              <span className="text-[0.85rem] text-ink/75">{fmtDia(a.created_at)}</span>
              <div className="col-span-2 flex gap-2 lg:col-span-1 lg:justify-end">
                <button type="button" onClick={() => setAberta({ a, i: 0 })} className="btn btn-line !min-h-[36px] !gap-1.5 !rounded-lg !px-3 !text-[0.78rem]"><Eye size={16} />Visualizar</button>
                <button type="button" onClick={() => baixar(a)} className="btn btn-gold !min-h-[36px] !gap-1.5 !rounded-lg !px-3 !text-[0.78rem]"><Download size={16} />Baixar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      </div>
    </>
  );

  const Cab = ({ t, s }: { t: string; s: string }) => (
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="text-[2rem] font-bold leading-tight sm:text-[2.4rem]">{t}</h1><p className="text-[0.88rem] text-ink/65">{s}</p></div>
      <div className="flex shrink-0 items-center gap-3">
        <Bell size={22} className="text-ink/80" aria-hidden />
        <span title={me.nome} className="grid h-11 w-11 place-items-center rounded-full font-bold text-white" style={{ background: 'linear-gradient(180deg,#d9b655,#a67c26)' }}>{me.nome.charAt(0)}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="flex flex-col bg-side text-white lg:sticky lg:top-0 lg:h-dvh lg:w-[240px] lg:shrink-0">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:px-6 lg:py-7">
          <Wordmark light />
          <button type="button" onClick={sair} aria-label="Sair" className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 lg:hidden"><LogOut size={20} /></button>
        </div>
        <nav aria-label="Principal" className="flex gap-2 overflow-x-auto px-4 pb-4 lg:flex-1 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-4 lg:pb-0">
          {NAV.map(([k, l, Icon]) => {
            const ativo = vista === k;
            return (
              <button key={k} type="button" onClick={() => { if (k === 'fotos') setF(VAZIO); setVista(k); }} aria-current={ativo ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-[0.92rem] font-medium transition ${ativo ? 'text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,.8)]' : 'text-white/80 hover:bg-white/5'}`}
                style={ativo ? { background: 'linear-gradient(180deg,#c9a24a,#a67c26)' } : undefined}>
                <Icon size={20} strokeWidth={1.7} />{l}
              </button>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 border-t border-white/10 px-5 py-5 lg:flex">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold" style={{ background: 'linear-gradient(180deg,#d9b655,#a67c26)' }}>{me.nome.charAt(0)}</span>
          <div className="min-w-0 flex-1 leading-tight"><p className="truncate text-[0.82rem] font-semibold">Administrador</p><p className="truncate text-[0.65rem] text-white/60">{me.email}</p></div>
          <button type="button" onClick={sair} aria-label="Sair" title="Sair" className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10"><LogOut size={19} /></button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-[#fcfbf8] px-5 py-6 sm:px-8 lg:py-8">
        <Cab t={vista === 'geral' ? 'Painel do Administrador' : NAV.find((n) => n[0] === vista)![1]} s="Gestão centralizada das fotografias clínicas" />

        {vista === 'geral' && (
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(([l, v, Icon]) => (
              <div key={l} className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Icon size={22} strokeWidth={1.6} /></span>
                <div className="leading-tight"><p className="text-[1.3rem] font-bold">{num(v)}</p><p className="text-[0.78rem] text-ink/65">{l}</p></div>
              </div>
            ))}
          </div>
        )}

        <div className={vista === 'geral' || vista === 'fotos' ? 'mt-7' : 'hidden'}>{tabela}</div>

        {vista === 'armazenamento' && <Armazenamento />}
        {vista === 'acessos' && <ControleAcesso meuId={me.id} />}

        {vista === 'alunos' && (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alunos.map((a) => (
              <li key={a.id}><button type="button" onClick={() => irFotos({ aluno_id: String(a.id) })} className="card w-full p-4 text-left transition hover:border-gold-500">
                <p className="font-bold">{nomeLimpo(a.nome)}</p><p className="text-[0.82rem] text-ink/60">{a.matricula ?? 'Sem matrícula'} · {a.cidade ?? 'Sem cidade'}</p>
                <p className="mt-2 text-[0.82rem] text-gold-700">{a.atendimentos} atendimento(s) · {a.fotos} foto(s)</p>
              </button></li>
            ))}
          </ul>
        )}
        {vista === 'pacientes' && (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pacientes.map((p) => (
              <li key={p.identificador}><button type="button" onClick={() => irFotos({ q: p.identificador })} className="card w-full p-4 text-left transition hover:border-gold-500">
                <p className="font-bold">{p.identificador}</p><p className="text-[0.82rem] text-ink/60">Último envio: {fmtDia(p.ultima)}</p>
                <p className="mt-2 text-[0.82rem] text-gold-700">{p.fotos} foto(s) · {p.alunos} aluno(s)</p>
              </button></li>
            ))}
          </ul>
        )}
        {vista === 'cidades' && (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cidades.map((c) => (
              <li key={c.id}><button type="button" onClick={() => irFotos({ cidade: String(c.id) })} className="card w-full p-4 text-left transition hover:border-gold-500">
                <p className="flex items-center gap-2 font-bold"><MapPin size={16} className="text-gold-500" />{c.nome}</p>
                <p className="mt-2 text-[0.82rem] text-gold-700">{c.alunos} aluno(s) · {c.fotos} foto(s)</p>
              </button></li>
            ))}
          </ul>
        )}
      </main>

      {aberta && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" className="fixed inset-0 z-[100] flex flex-col bg-ink/95" onClick={() => setAberta(null)}>
          <div className="flex items-center justify-between gap-4 p-4 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm">
              <p className="font-semibold">{aberta.a.identificador_paciente} <span className="text-white/60">· {aberta.i + 1}/{aberta.a.fotos.length}</span></p>
              <p className="text-white/70">Enviada por {nomeLimpo(aberta.a.aluno.nome)}{aberta.a.aluno.matricula ? ` (${aberta.a.aluno.matricula})` : ''} · {aberta.a.cidade} · {fmtData(aberta.a.fotos[aberta.i].created_at)}</p>
            </div>
            <button type="button" onClick={() => setAberta(null)} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-2xl">×</button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoUrl(aberta.a.fotos[aberta.i].id)} alt="" onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-lg object-contain" />
            {aberta.a.fotos.length > 1 && (
              <>
                <button type="button" aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setAberta({ a: aberta.a, i: (aberta.i - 1 + aberta.a.fotos.length) % aberta.a.fotos.length }); }} className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm">‹</button>
                <button type="button" aria-label="Próxima" onClick={(e) => { e.stopPropagation(); setAberta({ a: aberta.a, i: (aberta.i + 1) % aberta.a.fotos.length }); }} className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm">›</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { me, sair } = useSession('ADMIN');
  if (!me) return <PageLoader />;
  return <Painel me={me} sair={sair} />;
}

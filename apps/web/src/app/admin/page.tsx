'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Download, Eye, GraduationCap, HardDrive, RotateCcw, Trash2, House, ImageIcon, LogOut, MapPin, ShieldCheck, Users } from 'lucide-react';
import { API, api, Atendimento, fotoUrl, fmtData, Me } from '@/lib/api';
import { fmtDia, nomeLimpo, useSession } from '@/lib/session';
import { Wordmark } from '@/components/Brand';
import Armazenamento from '@/components/Armazenamento';
import PageLoader from '@/components/PageLoader';
import ControleAcesso from '@/components/ControleAcesso';

type Vista = 'geral' | 'fotos' | 'alunos' | 'pacientes' | 'cidades' | 'armazenamento' | 'acessos' | 'exclusoes';
type Excl = { id: number; atendimento_id: number; oculta_em: string; identificador_paciente: string; cidade: string; aluno: { id: number; nome: string; matricula: string | null } };
type Resumo = { fotos: number; pacientes: number; alunos: number; cidades: number; pendentes: number; ocultas?: number };
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
  ['exclusoes', 'Exclusões', Trash2],
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
  const [aoVivo, setAoVivo] = useState(false);
  const [excl, setExcl] = useState<Excl[]>([]);
  const [confirmaId, setConfirmaId] = useState<number | null>(null);
  const [avisos, setAvisos] = useState<{ id: number; texto: string }[]>([]);
  const [confirmaLb, setConfirmaLb] = useState(false);
  const [novos, setNovos] = useState<Set<number>>(new Set());
  const fRef = useRef(f);
  fRef.current = f;
  const tResumo = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const carregarExcl = useCallback(() => api<Excl[]>('/admin/exclusoes').then(setExcl).catch(() => null), []);
  const atualizarResumo = useCallback(() => api<Resumo>('/admin/resumo').then(setResumo).catch(() => null), []);
  useEffect(() => { if (vista === 'exclusoes') carregarExcl(); }, [vista, carregarExcl]);

  /** Exclusão definitiva (administrador): remove do armazenamento e dos painéis. */
  async function excluirDefinitivo(fotoId: number) {
    try {
      await api(`/admin/fotos/${fotoId}`, { method: 'DELETE' });
      setExcl((l) => l.filter((x) => x.id !== fotoId));
      setLista((l) => l.map((a) => ({ ...a, fotos: a.fotos.filter((ft) => ft.id !== fotoId) })).filter((a) => a.fotos.length));
      setConfirmaId(null);
      setConfirmaLb(false);
      setAberta((ab) => {
        if (!ab) return ab;
        const resto = ab.a.fotos.filter((ft) => ft.id !== fotoId);
        return resto.length ? { a: { ...ab.a, fotos: resto }, i: Math.min(ab.i, resto.length - 1) } : null;
      });
      atualizarResumo();
    } catch { /* mantém a foto na tela */ }
  }

  async function restaurar(fotoId: number, atendimentoId: number) {
    try {
      await api(`/admin/fotos/${fotoId}/restaurar`, { method: 'POST' });
      setExcl((l) => l.filter((x) => x.id !== fotoId));
      atualizarResumo();
      receber([atendimentoId]);
    } catch { /* tenta de novo */ }
  }

  /** Tempo real: o servidor avisa os ids novos (SSE); busca só esses registros (já com os filtros ativos) e os coloca no topo. */
  const receber = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    const qs = new URLSearchParams(Object.entries(fRef.current).filter(([, v]) => v));
    qs.set('ids', ids.join(','));
    try {
      const novosItens = await api<Atendimento[]>(`/admin/atendimentos?${qs}`);
      if (novosItens.length) {
        const idsNovos = new Set(novosItens.map((x) => x.id));
        setLista((l) => [...novosItens, ...l.filter((x) => !idsNovos.has(x.id))].sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at)).slice(0, 200));
        setNovos((n) => new Set([...n, ...idsNovos]));
        setTimeout(() => setNovos((n) => { const c = new Set(n); idsNovos.forEach((i) => c.delete(i)); return c; }), 8000);
      }
    } catch { /* o próximo evento ou a busca manual recompõe a lista */ }
    if (tResumo.current) clearTimeout(tResumo.current);
    tResumo.current = setTimeout(() => api<Resumo>('/admin/resumo').then(setResumo).catch(() => null), 2500); // contadores: no máximo 1 consulta a cada 2,5 s
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let parar = false;
    let tentativa = 0;
    let t: ReturnType<typeof setTimeout>;
    const abrir = () => {
      es = new EventSource(`${API}/admin/eventos`, { withCredentials: true });
      es.onopen = () => { tentativa = 0; setAoVivo(true); };
      es.addEventListener('novos', (e) => {
        try { receber((JSON.parse((e as MessageEvent).data) as { ids: number[] }).ids); } catch { /* mensagem inválida */ }
      });
      es.addEventListener('exclusao', (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data) as { foto_id: number; atendimento_id: number; paciente: string; aluno: { nome: string } };
          const id = Date.now() + d.foto_id;
          setAvisos((v) => [...v.slice(-3), { id, texto: `${nomeLimpo(d.aluno.nome)} excluiu uma foto do paciente ${d.paciente}` }]);
          setTimeout(() => setAvisos((v) => v.filter((x) => x.id !== id)), 9000);
          api<Resumo>('/admin/resumo').then(setResumo).catch(() => null);
          api<Excl[]>('/admin/exclusoes').then(setExcl).catch(() => null);
          receber([d.atendimento_id]);
        } catch { /* mensagem inválida */ }
      });
      es.onerror = async () => {
        es?.close();
        setAoVivo(false);
        if (parar) return;
        await api('/auth/me').catch(() => null); // renova a sessão (refresh) se o acesso expirou
        t = setTimeout(abrir, Math.min(30_000, 1500 * 2 ** tentativa++));
      };
    };
    abrir();
    const volta = () => { if (document.visibilityState === 'visible') buscar(fRef.current); }; // ao voltar para a aba, recompõe o que passou
    document.addEventListener('visibilitychange', volta);
    return () => { parar = true; es?.close(); clearTimeout(t); document.removeEventListener('visibilitychange', volta); };
  }, [receber, buscar]);

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
      <div className="flex items-center gap-3"><h2 className="text-[1.6rem] font-bold">Fotos dos Atendimentos</h2><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold ${aoVivo ? 'bg-[#e7f6ee] text-[#17794a]' : 'bg-sand text-ink/50'}`} title={aoVivo ? 'Atualização em tempo real ativa' : 'Reconectando…'}><span className={`h-2 w-2 rounded-full ${aoVivo ? 'animate-pulse bg-[#22a35a]' : 'bg-ink/30'}`} />{aoVivo ? 'Ao vivo' : 'Offline'}</span></div>
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
          <li key={a.id} className={`${novos.has(a.id) ? 'novo-envio ' : ''}grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 transition last:border-b-0 hover:bg-ivory lg:grid-cols-[130px_90px_1.3fr_1fr_100px_auto]`}>
            <button type="button" onClick={() => setAberta({ a, i: 0 })} aria-label="Visualizar fotos" className="flex overflow-hidden rounded-lg bg-sand">
              {a.fotos.slice(0, 2).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={fotoUrl(p.id, true)} alt="" loading="lazy" title={p.oculta ? 'Excluída pelo aluno' : undefined} className={`h-14 w-14 object-cover lg:h-[52px] lg:w-[52px] ${p.oculta ? 'opacity-40 grayscale' : ''}`} />
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
                {k === 'exclusoes' && !!resumo?.ocultas && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#b3261e] px-1.5 text-[0.68rem] font-bold text-white">{resumo.ocultas}</span>}
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
        {vista === 'exclusoes' && (
          <div className="mt-6">
            <p className="max-w-[640px] text-[0.88rem] text-ink/65">Fotos que os alunos excluíram. Elas ficam ocultas para o aluno e continuam guardadas até você decidir: restaurar ou excluir em definitivo (isso remove o arquivo do armazenamento).</p>
            {excl.length === 0 ? (
              <div className="card mt-4 px-4 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Trash2 size={22} /></span><p className="mt-3 font-semibold">Nenhuma exclusão pendente</p></div>
            ) : (
              <ul className="card mt-4 divide-y divide-line overflow-hidden">
                {excl.map((x) => (
                  <li key={x.id} className="novo-envio flex flex-wrap items-center gap-3 px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoUrl(x.id, true)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-line" />
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate font-bold">Paciente: {x.identificador_paciente}</p>
                      <p className="text-[0.8rem] text-ink/65">{nomeLimpo(x.aluno.nome)} ({x.aluno.matricula ?? 'sem matrícula'}) · {x.cidade}</p>
                      <p className="text-[0.76rem] text-[#b3261e]">Excluída em {fmtData(x.oculta_em)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => restaurar(x.id, x.atendimento_id)} className="btn btn-line !min-h-[36px] !gap-1.5 !rounded-lg !px-3 !text-[0.78rem]"><RotateCcw size={15} />Restaurar</button>
                      {confirmaId === x.id ? (
                        <>
                          <button type="button" onClick={() => excluirDefinitivo(x.id)} className="rounded-lg bg-[#b3261e] px-3 py-2 text-[0.78rem] font-semibold text-white">Confirmar exclusão</button>
                          <button type="button" onClick={() => setConfirmaId(null)} className="rounded-lg px-2 text-[0.78rem] font-semibold text-ink/60">Cancelar</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmaId(x.id)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#b3261e]/40 px-3 text-[0.78rem] font-semibold text-[#b3261e] transition hover:bg-[#fdf0ee]"><Trash2 size={15} />Excluir definitivo</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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

      <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(92vw,360px)] flex-col gap-2">
        {avisos.map((a) => (
          <button key={a.id} type="button" onClick={() => { setVista('exclusoes'); setAvisos((v) => v.filter((x) => x.id !== a.id)); }} className="pop pointer-events-auto flex items-start gap-3 rounded-xl border border-[#b3261e]/30 bg-white p-3 text-left shadow-[0_18px_40px_-18px_rgba(90,30,20,.5)]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fdf0ee] text-[#b3261e]"><Trash2 size={16} /></span>
            <span className="text-[0.85rem] leading-snug"><b className="block">Foto excluída por aluno</b>{a.texto}</span>
          </button>
        ))}
      </div>

      {aberta && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" className="fixed inset-0 z-[100] flex flex-col bg-ink/95" onClick={() => setAberta(null)}>
          <div className="flex items-center justify-between gap-4 p-4 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm">
              <p className="font-semibold">{aberta.a.identificador_paciente} <span className="text-white/60">· {aberta.i + 1}/{aberta.a.fotos.length}</span></p>
              <p className="text-white/70">Enviada por {nomeLimpo(aberta.a.aluno.nome)}{aberta.a.aluno.matricula ? ` (${aberta.a.aluno.matricula})` : ''} · {aberta.a.cidade} · {fmtData(aberta.a.fotos[aberta.i].created_at)}{aberta.a.fotos[aberta.i].oculta ? ' · EXCLUÍDA PELO ALUNO' : ''}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {confirmaLb ? (
                <>
                  <button type="button" onClick={() => excluirDefinitivo(aberta.a.fotos[aberta.i].id)} className="rounded-full bg-[#b3261e] px-4 py-2 text-sm font-semibold text-white">Confirmar exclusão</button>
                  <button type="button" onClick={() => setConfirmaLb(false)} className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white">Cancelar</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmaLb(true)} aria-label="Excluir definitivamente" title="Excluir definitivamente" className="grid h-10 w-10 place-items-center rounded-full bg-[#b3261e]/80 text-white transition hover:bg-[#b3261e]"><Trash2 size={18} /></button>
              )}
              <button type="button" onClick={() => { setAberta(null); setConfirmaLb(false); }} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-2xl">×</button>
            </div>
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

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSecao } from '@/lib/rota';
import { Bell, Download, Eye, GraduationCap, HardDrive, RotateCcw, Trash2, House, ImageIcon, LogOut, MapPin, ShieldCheck, Users, Smartphone, RefreshCw, Settings, ChevronsUpDown, SlidersHorizontal, ChevronDown, LayoutGrid, Menu, X, Search, ScrollText, Megaphone, PlusCircle, History } from 'lucide-react';
import { API, api, Atendimento, fotoUrl, fmtData, Me } from '@/lib/api';

type Pagina = { itens: Atendimento[]; proximo: string | null };
import { fmtDia, nomeLimpo, useSession } from '@/lib/session';
import { Wordmark } from '@/components/Brand';
import Armazenamento from '@/components/Armazenamento';
import PageLoader from '@/components/PageLoader';
import ControleAcesso from '@/components/ControleAcesso';
import VisaoGeral from '@/components/VisaoGeral';
import Titulo from '@/components/Titulo';
import MostrarMais, { PASSO } from '@/components/MostrarMais';
import BuscaAluno from '@/components/BuscaAluno';
import Avatar from '@/components/Avatar';
import PerfilInicial from '@/components/PerfilInicial';
import Aplicativo from '@/components/Aplicativo';
import Auditoria from '@/components/Auditoria';
import MuralAvisos from '@/components/MuralAvisos';
import Notificacoes from '@/components/Notificacoes';
import MeusEnvios, { MeusEnviosHandle } from '@/components/MeusEnvios';

type Vista = 'geral' | 'fotos' | 'alunos' | 'pacientes' | 'cidades' | 'armazenamento' | 'acessos' | 'exclusoes' | 'aplicativo' | 'auditoria' | 'avisos';
type Excl = { id: number; atendimento_id: number; oculta_em: string; identificador_paciente: string; cidade: string; aluno: { id: number; nome: string; matricula: string | null } };
type Resumo = { fotos: number; pacientes: number; alunos: number; cidades: number; pendentes: number; ocultas?: number };
type Cidade = { id: number; nome: string; alunos: number; fotos: number };
type Aluno = { id: number; nome: string; matricula: string | null; cidade: string | null; atendimentos: number; fotos: number };
type Paciente = { identificador: string; alunos: number; fotos: number; ultima: string };
type Filtros = { cidade: string; aluno_id: string; q: string; de: string; ate: string };
const VAZIO: Filtros = { cidade: '', aluno_id: '', q: '', de: '', ate: '' };

/** Seções válidas = caminhos /admin/<seção> (a inicial fica em /admin). */
const SECOES: readonly Vista[] = ['geral', 'fotos', 'alunos', 'pacientes', 'cidades', 'armazenamento', 'acessos', 'exclusoes', 'aplicativo', 'auditoria', 'avisos'];
const GOV: Vista[] = ['exclusoes', 'acessos', 'auditoria', 'armazenamento'];
const NAV: [Vista, string, typeof House][] = [
  ['geral', 'Visão Geral', House],
  ['fotos', 'Fotos', ImageIcon],
  ['alunos', 'Alunos', GraduationCap],
  ['pacientes', 'Pacientes', Users],
  ['cidades', 'Cidades', MapPin],
  ['avisos', 'Mural de Avisos', Megaphone],
  ['exclusoes', 'Exclusões', Trash2],
  ['acessos', 'Controle de Acesso', ShieldCheck],
  ['auditoria', 'Auditoria', ScrollText],
  ['aplicativo', 'Aplicativo', Smartphone],
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

function Painel({ me, sair, abrirConfig }: { me: Me; sair: () => void; abrirConfig: () => void }) {
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [menuMovel, setMenuMovel] = useState(false);
  const [menuTopo, setMenuTopo] = useState(false);
  useEffect(() => {
    if (!menuTopo) return;
    const fecha = (e: Event) => { if (!(e.target as HTMLElement).closest('[data-menu-topo]')) setMenuTopo(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuTopo(false); };
    document.addEventListener('mousedown', fecha); document.addEventListener('touchstart', fecha); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fecha); document.removeEventListener('touchstart', fecha); document.removeEventListener('keydown', esc); };
  }, [menuTopo]);
  const [buscaMenu, setBuscaMenu] = useState('');
  const buscaRef = useRef<HTMLInputElement>(null);
  const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const [govAberto, setGovAberto] = useState(false);
  const termo = semAcento(buscaMenu.trim());
  // Sem busca: itens principais (o grupo Governança fica embaixo); com busca: todos os itens que combinam.
  const itensMenu = NAV.filter(([k, l]) => (termo ? semAcento(l).includes(termo) : !GOV.includes(k)));
  // Atalho "/" foca a busca do menu (fora de campos de texto).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) { e.preventDefault(); setMenuMovel(true); buscaRef.current?.focus(); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  // Celular: menu lateral vira gaveta (hambúrguer); fecha com Esc e trava a rolagem do fundo.
  useEffect(() => {
    if (!menuMovel) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuMovel(false); };
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, [menuMovel]);
  useEffect(() => {
    if (!menuUsuario) return;
    const fecha = (e: Event) => { if (!(e.target as HTMLElement).closest('[data-menu-usuario]')) setMenuUsuario(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuUsuario(false); };
    document.addEventListener('mousedown', fecha); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fecha); document.removeEventListener('keydown', esc); };
  }, [menuUsuario]);
  const [vista, setVista] = useSecao<Vista>('/admin', SECOES, 'geral');
  const [fotosAba, setFotosAba] = useState<'todas' | 'meus'>('todas');
  const envios = useRef<MeusEnviosHandle>(null);
  const [totalEnvios, setTotalEnvios] = useState(0);
  const [proximo, setProximo] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const maisBusy = useRef(false);
  const [nAlunos, setNAlunos] = useState(PASSO);
  const [nPac, setNPac] = useState(PASSO);
  const [nExcl, setNExcl] = useState(PASSO);
  const sentinela = useRef<HTMLDivElement>(null);
  const [rk, setRk] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  useEffect(() => { if (GOV.includes(vista)) setGovAberto(true); }, [vista]);
  const [f, setF] = useState<Filtros>(VAZIO);
  const [resumo, setResumo] = useState<Resumo>();
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [lista, setLista] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberta, setAberta] = useState<{ a: Atendimento; i: number } | null>(null);
  const [excl, setExcl] = useState<Excl[]>([]);
  const [confirmaId, setConfirmaId] = useState<number | null>(null);
  const [avisos, setAvisos] = useState<{ id: number; texto: string }[]>([]);
  const [confirmaLb, setConfirmaLb] = useState(false);
  const [delAt, setDelAt] = useState<Atendimento | null>(null);
  const [delBusy, setDelBusy] = useState(false);
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
    try { const r = await api<Pagina>(`/admin/atendimentos?${qs}`); setLista(r.itens); setProximo(r.proximo); } finally { setLoading(false); }
  }, []);
  /** Próxima página (cursor): acrescenta sem refazer o que já está na tela. */
  const carregarMais = useCallback(async () => {
    if (!proximo || maisBusy.current) return;
    maisBusy.current = true;
    setCarregandoMais(true);
    try {
      const qs = new URLSearchParams(Object.entries(fRef.current).filter(([, v]) => v));
      qs.set('cursor', proximo);
      const r = await api<Pagina>(`/admin/atendimentos?${qs}`);
      setLista((l) => { const ja = new Set(l.map((x) => x.id)); return [...l, ...r.itens.filter((x) => !ja.has(x.id))]; });
      setProximo(r.proximo);
    } catch { /* o botão Mostrar mais tenta de novo */ } finally { maisBusy.current = false; setCarregandoMais(false); }
  }, [proximo]);
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

  /** Exclui em definitivo todas as fotos do atendimento (após confirmar no modal). */
  async function excluirAtendimento() {
    if (!delAt) return;
    setDelBusy(true);
    for (const ft of delAt.fotos) await excluirDefinitivo(ft.id);
    setDelBusy(false);
    setDelAt(null);
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
      const novosItens = (await api<Pagina>(`/admin/atendimentos?${qs}`)).itens;
      if (novosItens.length) {
        const idsNovos = new Set(novosItens.map((x) => x.id));
        setLista((l) => [...novosItens, ...l.filter((x) => !idsNovos.has(x.id))].sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at)));
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
      es.onopen = () => { tentativa = 0; };
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


  const tabela = (
    <>
      <div className="flex items-center gap-3"><Titulo icone={ImageIcon}>Fotos dos Atendimentos</Titulo><button type="button" onClick={() => setFiltrosAbertos((v) => !v)} aria-expanded={filtrosAbertos} className="ml-auto inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-[0.82rem] font-semibold text-ink/80 transition hover:bg-ivory"><SlidersHorizontal size={16} />Filtros{Object.values(f).filter(Boolean).length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold-600 px-1.5 text-[0.68rem] font-bold text-white">{Object.values(f).filter(Boolean).length}</span>}<ChevronDown size={15} className={`transition ${filtrosAbertos ? 'rotate-180' : ''}`} /></button></div>
      {filtrosAbertos && <div className="card fade-in mt-3 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-[0.78rem] font-semibold text-ink/70">Cidade
          <select value={f.cidade} onChange={set('cidade')} className="field-plain mt-1"><option value="">Todas</option>{cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </label>
        <div className="text-[0.78rem] font-semibold text-ink/70">Aluno
          <BuscaAluno valor={f.aluno_id} rotuloExterno={(() => { const a = alunos.find((x) => String(x.id) === f.aluno_id); return a ? `${nomeLimpo(a.nome)}${a.matricula ? ` (${a.matricula})` : ''}` : undefined; })()} onChange={(id) => setF((x) => ({ ...x, aluno_id: id }))} />
        </div>
        <label className="text-[0.78rem] font-semibold text-ink/70">Paciente
          <select value={f.q} onChange={set('q')} className="field-plain mt-1"><option value="">Todos</option>{pacientes.map((p) => <option key={p.identificador} value={p.identificador}>{p.identificador}</option>)}</select>
        </label>
        <div className="text-[0.78rem] font-semibold text-ink/70">Período
          <div className="mt-1 flex items-center gap-1.5">
            <input type="date" aria-label="De" value={f.de} onChange={set('de')} className="field-plain min-w-0 flex-1 !px-2" />
            <input type="date" aria-label="Até" value={f.ate} onChange={set('ate')} className="field-plain min-w-0 flex-1 !px-2" />
          </div>
        </div>
      </div>}

      <div className="card mt-4 overflow-hidden !p-0">
      <div className="hidden grid-cols-[130px_90px_1.3fr_1fr_100px_auto_70px] items-center gap-4 border-b border-line bg-[#f3efe7] px-4 py-3 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-ink/70 lg:grid">
        <span>Prévia</span><span>Paciente</span><span>Aluno (Matrícula)</span><span>Cidade</span><span>Data</span><span className="text-right">Ações</span><span className="text-center">Excluir</span>
      </div>
      {loading && lista.length === 0 && <div className="space-y-3 p-4" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-sand" />)}</div>}
      {!loading && lista.length === 0 && <div className="px-4 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><ImageIcon size={22} /></span><p className="mt-3 font-semibold">Nenhum atendimento encontrado</p><p className="text-[0.85rem] text-ink/55">Ajuste os filtros para ampliar a busca.</p></div>}
      <ul className={loading ? 'opacity-60 transition' : 'transition'}>
        {lista.map((a) => (
          <li key={a.id} className={`${novos.has(a.id) ? 'novo-envio ' : ''}grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 transition last:border-b-0 hover:bg-ivory lg:grid-cols-[130px_90px_1.3fr_1fr_100px_auto_70px]`}>
            <button type="button" onClick={() => setAberta({ a, i: 0 })} aria-label="Visualizar fotos" className="flex w-[130px] overflow-hidden rounded-lg bg-sand">
              {a.fotos.slice(0, 2).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={fotoUrl(p.id, true)} alt="" loading="lazy" className="h-14 min-w-0 flex-1 object-cover lg:h-[52px]" />
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
              <div className="col-span-2 flex lg:col-span-1 lg:justify-center">
                <button type="button" onClick={() => setDelAt(a)} aria-label="Excluir fotos do atendimento" title="Excluir" className="grid h-9 w-9 place-items-center rounded-lg border border-[#b3261e]/40 text-[#b3261e] transition hover:bg-[#fdf0ee]"><Trash2 size={16} /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <MostrarMais auto temMais={!!proximo} carregando={carregandoMais} onClick={carregarMais} mostrados={lista.length} />
      </div>
    </>
  );

  /** Recarrega os dados da seção aberta, sem recarregar a página. */
  function atualizar() {
    setAtualizando(true);
    setRk((n) => n + 1);
    atualizarResumo();
    api<Cidade[]>('/admin/cidades').then(setCidades).catch(() => null);
    api<Aluno[]>('/admin/alunos').then(setAlunos).catch(() => null);
    api<Paciente[]>('/admin/pacientes').then(setPacientes).catch(() => null);
    carregarExcl();
    Promise.resolve(buscar(f)).finally(() => setTimeout(() => setAtualizando(false), 500));
  }

  const Cab = ({ t, s }: { t: string; s: string }) => (
    <div className="flex items-start justify-between gap-4">
      <div><Titulo nivel={1} icone={NAV.find((n) => n[0] === vista)![2]}>{t}</Titulo><p className="mt-1.5 pl-[60px] text-[0.88rem] text-ink/65">{s}</p></div>
      <div className="flex shrink-0 items-center gap-3">
        <button type="button" onClick={atualizar} disabled={atualizando} aria-label="Atualizar" title="Atualizar" className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-[0.82rem] font-semibold text-ink/80 transition hover:bg-ivory disabled:opacity-70"><RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} /><span className="hidden sm:inline">Atualizar</span></button>
      </div>
    </div>
  );

  const botaoNav = (k: Vista, l: string, Icon: typeof House, i: number, sub = false) => {
    const ativo = vista === k;
    return (
      <button key={k} type="button" onClick={() => { if (k === 'fotos') setF(VAZIO); setVista(k); setMenuMovel(false); setBuscaMenu(''); }} aria-current={ativo ? 'page' : undefined}
        className={`nav-item flex shrink-0 items-center rounded-xl text-left font-medium transition ${sub ? 'gap-2.5 whitespace-nowrap px-2.5 py-2.5 text-[0.88rem]' : 'gap-3 px-4 py-3 text-[0.92rem]'} ${ativo ? 'text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,.8)]' : 'text-white/80 hover:bg-white/5'}`}
        style={{ '--d': `${120 + i * 70}ms`, ...(ativo ? { background: 'linear-gradient(180deg,#c9a24a,#a67c26)' } : {}) } as React.CSSProperties}>
        <Icon size={sub ? 18 : 20} strokeWidth={1.7} />{l}
        {k === 'exclusoes' && !!resumo?.ocultas && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#b3261e] px-1.5 text-[0.68rem] font-bold text-white">{resumo.ocultas}</span>}
      </button>
    );
  };

  return (
    <div className="min-h-dvh lg:flex">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-side px-4 py-3 text-white lg:hidden">
        <button type="button" onClick={() => setMenuMovel(true)} aria-label="Abrir menu" aria-expanded={menuMovel} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10"><Menu size={24} /></button>
        <button type="button" onClick={() => setVista('geral')} aria-label="Ir para a tela inicial" className="select-none"><Wordmark light /></button>
        <div className="flex items-center gap-2.5">
        <Notificacoes lugar="topo" />
        <div data-menu-topo className="relative">
          <button type="button" onClick={() => setMenuTopo((v) => !v)} aria-haspopup="menu" aria-expanded={menuTopo} aria-label="Menu do usuário" className="block rounded-full">
            {me.foto_url ? <Avatar foto={me.foto_url} size={36} semBorda /> : <span className="grid h-9 w-9 place-items-center rounded-full text-[0.9rem] font-bold" style={{ background: 'linear-gradient(180deg,#d9b655,#a67c26)' }}>{me.nome.charAt(0)}</span>}
          </button>
          {menuTopo && (
            <div role="menu" className="pop absolute right-0 top-full z-50 mt-2.5 w-[230px] overflow-hidden rounded-xl bg-white py-1.5 text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)]">
              <div className="border-b border-line px-4 pb-2.5 pt-2"><p className="truncate text-[0.9rem] font-semibold">{nomeLimpo(me.nome)}</p><p className="truncate text-[0.72rem] text-ink/55">{me.email}</p></div>
              <button type="button" role="menuitem" onClick={() => { setMenuTopo(false); abrirConfig(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[0.92rem] font-medium transition hover:bg-ivory"><Settings size={18} className="text-gold-600" />Configurações</button>
              <button type="button" role="menuitem" onClick={sair} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[0.92rem] font-medium transition hover:bg-ivory"><LogOut size={18} className="text-gold-600" />Sair</button>
            </div>
          )}
        </div>
        </div>
      </header>
      {menuMovel && <div className="fade-in fixed inset-0 z-40 bg-black/55 lg:hidden" onClick={() => setMenuMovel(false)} aria-hidden />}
      <aside aria-label="Menu lateral" className={`fixed inset-y-0 left-0 z-50 flex w-[290px] max-w-[85vw] flex-col bg-side text-white shadow-2xl transition-[transform,visibility] duration-300 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-[256px] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none ${menuMovel ? 'translate-x-0' : 'max-lg:invisible max-lg:-translate-x-full'}`}>
        <div className="flex items-center justify-between gap-2 px-5 py-5 lg:px-5 lg:py-6">
          <button type="button" onClick={() => { setVista('geral'); setMenuMovel(false); }} aria-label="Ir para a tela inicial" className="select-none text-left"><Wordmark light /></button>
          <button type="button" onClick={() => setMenuMovel(false)} aria-label="Fechar menu" className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 lg:hidden"><X size={22} /></button>
          <span className="hidden lg:block"><Notificacoes lugar="menu" /></span>
        </div>
        <div className="relative px-4 pb-3">
          <Search size={17} className="pointer-events-none absolute left-7 top-1/2 -translate-y-[calc(50%+6px)] text-white/55" aria-hidden />
          <input ref={buscaRef} value={buscaMenu} onChange={(e) => setBuscaMenu(e.target.value)} aria-label="Buscar no menu" placeholder="Buscar no menu..." autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setBuscaMenu(''); e.currentTarget.blur(); }
              if (e.key === 'Enter' && itensMenu[0]) { const k = itensMenu[0][0]; if (k === 'fotos') setF(VAZIO); setVista(k); setMenuMovel(false); setBuscaMenu(''); e.currentTarget.blur(); }
            }}
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] py-2.5 pl-10 pr-10 text-[0.88rem] text-white outline-none transition placeholder:text-white/50 focus:border-[#c9a24a] focus:bg-white/10" />
          {buscaMenu ? <button type="button" onClick={() => { setBuscaMenu(''); buscaRef.current?.focus(); }} aria-label="Limpar busca" className="absolute right-7 top-1/2 -translate-y-[calc(50%+6px)] text-white/60 hover:text-white"><X size={15} /></button>
            : <kbd className="pointer-events-none absolute right-7 top-1/2 hidden -translate-y-[calc(50%+6px)] rounded-md border border-white/20 px-1.5 text-[0.7rem] text-white/55 lg:block">/</kbd>}
        </div>
        <nav aria-label="Principal" className="scroll-fino flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-3">
          {itensMenu.length === 0 && <p className="px-4 py-3 text-[0.85rem] text-white/55">Nenhum item encontrado.</p>}
          {itensMenu.map(([k, l, Icon], i) => botaoNav(k, l, Icon, i))}
        </nav>
        {!buscaMenu.trim() && (
          <div className="shrink-0 px-4 pb-2 pt-1">
            <button type="button" onClick={() => setGovAberto((v) => !v)} aria-expanded={govAberto} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[0.92rem] font-semibold text-white/75 transition hover:bg-white/5 hover:text-white">
              <ShieldCheck size={20} strokeWidth={1.7} />Governança
              {!govAberto && !!resumo?.ocultas && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#b3261e] px-1.5 text-[0.68rem] font-bold text-white">{resumo.ocultas}</span>}
              <ChevronDown size={16} className={`${!govAberto && resumo?.ocultas ? '' : 'ml-auto'} transition ${govAberto ? '' : 'rotate-180'}`} />
            </button>
            {govAberto && (
              <div className="fade-in ml-5 mt-1 flex flex-col gap-1 border-l border-white/15 pl-2">
                {NAV.filter(([k]) => GOV.includes(k)).map(([k, l, Icon], i) => botaoNav(k, l, Icon, i, true))}
              </div>
            )}
          </div>
        )}
        <div data-menu-usuario className="relative shrink-0 border-t border-white/10 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {menuUsuario && (
            <div role="menu" className="pop absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-xl bg-white py-1.5 text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)]">
              <button type="button" role="menuitem" onClick={() => { setMenuUsuario(false); setMenuMovel(false); abrirConfig(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[0.9rem] font-medium transition hover:bg-ivory"><Settings size={18} className="text-gold-600" />Configurações</button>
              <button type="button" role="menuitem" onClick={sair} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[0.9rem] font-medium transition hover:bg-ivory"><LogOut size={18} className="text-gold-600" />Sair</button>
            </div>
          )}
          <button type="button" onClick={() => setMenuUsuario((v) => !v)} aria-haspopup="menu" aria-expanded={menuUsuario} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5">
            {me.foto_url ? <Avatar foto={me.foto_url} size={40} semBorda /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold" style={{ background: 'linear-gradient(180deg,#d9b655,#a67c26)' }}>{me.nome.charAt(0)}</span>}
            <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[0.85rem] font-semibold">{nomeLimpo(me.nome)}</span><span className="block truncate text-[0.68rem] text-white/60">{me.email}</span></span>
            <ChevronsUpDown size={16} className="shrink-0 text-white/60" aria-hidden />
          </button>
        </div>
      </aside>

      <main className={`min-w-0 flex-1 bg-page px-3 py-5 sm:px-8 sm:py-6 lg:py-8 ${vista === 'fotos' ? 'pb-28 sm:pb-28 lg:pb-28' : ''}`}>
        <Cab t={vista === 'geral' ? 'Painel do Administrador' : NAV.find((n) => n[0] === vista)![1]} s="Gestão centralizada das fotografias clínicas" />

        {vista === 'geral' && <VisaoGeral key={rk} recentes={lista} irPara={(v) => setVista(v)} abrir={(a) => setAberta({ a, i: 0 })} />}

        <div className={vista === 'fotos' && fotosAba === 'todas' ? 'mt-7' : 'hidden'}>{tabela}</div>
        {vista === 'fotos' && fotosAba === 'todas' && lista.some((a) => a.fotos.length) && (
          <section className="mt-8" aria-label="Galeria de fotos">
            <Titulo nivel={3} icone={LayoutGrid}>Galeria <span className="text-[0.85rem] font-medium text-ink/55">· {lista.reduce((n, a) => n + a.fotos.length, 0)} foto(s)</span></Titulo>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {lista.flatMap((a) => a.fotos.map((p, i) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setAberta({ a, i })} aria-label={`Ver foto de ${a.identificador_paciente}`} className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-sand shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoUrl(p.id, true)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6 text-left text-white">
                      <span className="block truncate text-[0.78rem] font-semibold">{a.identificador_paciente}</span>
                      <span className="block truncate text-[0.68rem] text-white/80">{nomeLimpo(a.aluno.nome)} · {fmtDia(p.created_at)}</span>
                    </span>
                  </button>
                </li>
              )))}
            </ul>
          </section>
        )}

        {vista === 'armazenamento' && <Armazenamento key={rk} />}
        {vista === 'aplicativo' && <Aplicativo key={rk} />}
        {vista === 'auditoria' && <Auditoria key={rk} />}
        {vista === 'fotos' && (
          <>
            <MeusEnvios ref={envios} modo="historico" semLista={fotosAba !== 'meus'} onTotal={setTotalEnvios} />
            <nav aria-label="Fotos" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:left-[256px]">
              <div className="mx-auto grid max-w-[560px] grid-cols-3 items-end">
                {([['todas', 'Todas as fotos', ImageIcon], ['novo', 'Novo envio', PlusCircle], ['meus', 'Meus envios', History]] as const).map(([k, l, Icone]) => {
                  const ativo = k !== 'novo' && fotosAba === k;
                  return (
                    <button key={k} type="button" aria-current={ativo ? 'page' : undefined} onClick={() => (k === 'novo' ? envios.current?.abrirMenu() : setFotosAba(k))}
                      className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[0.7rem] font-semibold transition lg:text-[0.78rem] ${ativo ? 'text-gold-700' : 'text-ink/65 hover:text-ink'}`}>
                      <span className={`relative grid place-items-center ${k === 'novo' ? 'h-9 w-12 rounded-xl text-white shadow-[0_8px_18px_-10px_rgba(150,100,10,.8)]' : 'h-9 w-9'}`} style={k === 'novo' ? { background: 'linear-gradient(180deg,#c9a24a,#a67c26)' } : undefined}>
                        <Icone size={k === 'novo' ? 22 : 21} strokeWidth={1.7} />
                        {k === 'meus' && totalEnvios > 0 && <span className="absolute -right-1.5 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#b3261e] px-1 text-[0.62rem] font-bold leading-none text-white ring-2 ring-white">{totalEnvios > 99 ? '99+' : totalEnvios}</span>}
                      </span>
                      {l}
                      {ativo && <span aria-hidden className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-gold-600" />}
                    </button>
                  );
                })}
              </div>
            </nav>
          </>
        )}
        {vista === 'avisos' && <MuralAvisos key={rk} />}
        {vista === 'acessos' && <ControleAcesso key={rk} meuId={me.id} />}
        {vista === 'exclusoes' && (
          <div className="mt-6">
            <p className="max-w-[640px] text-[0.88rem] text-ink/65">Fotos que os alunos excluíram. Elas ficam ocultas para o aluno e continuam guardadas até você decidir: restaurar ou excluir em definitivo (isso remove o arquivo do armazenamento).</p>
            {excl.length === 0 ? (
              <div className="card mt-4 px-4 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Trash2 size={22} /></span><p className="mt-3 font-semibold">Nenhuma exclusão pendente</p></div>
            ) : (
              <ul className="card mt-4 divide-y divide-line overflow-hidden">
                {excl.slice(0, nExcl).map((x) => (
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
              <li className="list-none"><MostrarMais temMais={excl.length > nExcl} onClick={() => setNExcl((n) => n + PASSO)} /></li>
              </ul>
            )}
          </div>
        )}

        {vista === 'alunos' && (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alunos.slice(0, nAlunos).map((a) => (
              <li key={a.id}><button type="button" onClick={() => irFotos({ aluno_id: String(a.id) })} className="card w-full p-4 text-left transition hover:border-gold-500">
                <p className="font-bold">{nomeLimpo(a.nome)}</p><p className="text-[0.82rem] text-ink/60">{a.matricula ?? 'Sem matrícula'} · {a.cidade ?? 'Sem cidade'}</p>
                <p className="mt-2 text-[0.82rem] text-gold-700">{a.atendimentos} atendimento(s) · {a.fotos} foto(s)</p>
              </button></li>
            ))}
          <li className="sm:col-span-2 xl:col-span-3"><MostrarMais temMais={alunos.length > nAlunos} onClick={() => setNAlunos((n) => n + PASSO)} /></li>
          </ul>
        )}
        {vista === 'pacientes' && (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pacientes.slice(0, nPac).map((p) => (
              <li key={p.identificador}><button type="button" onClick={() => irFotos({ q: p.identificador })} className="card w-full p-4 text-left transition hover:border-gold-500">
                <p className="font-bold">{p.identificador}</p><p className="text-[0.82rem] text-ink/60">Último envio: {fmtDia(p.ultima)}</p>
                <p className="mt-2 text-[0.82rem] text-gold-700">{p.fotos} foto(s) · {p.alunos} aluno(s)</p>
              </button></li>
            ))}
          <li className="sm:col-span-2 xl:col-span-3"><MostrarMais temMais={pacientes.length > nPac} onClick={() => setNPac((n) => n + PASSO)} /></li>
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

      {delAt && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar exclusão" className="fixed inset-0 z-[110] grid place-items-center bg-ink/60 p-4" onClick={() => !delBusy && setDelAt(null)}>
          <div className="pop w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#fdf0ee] text-[#b3261e]"><Trash2 size={20} /></span>
            <h3 className="mt-3 text-[1.15rem] font-bold">Tem certeza que deseja excluir?</h3>
            <p className="mt-1 text-[0.88rem] text-ink/65">{delAt.fotos.length} foto{delAt.fotos.length > 1 ? 's' : ''} do paciente <b>{delAt.identificador_paciente}</b> serão removidas em definitivo. Essa ação não pode ser desfeita.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={delBusy} onClick={() => setDelAt(null)} className="btn btn-line !min-h-[40px] !rounded-lg !px-4 !text-[0.85rem]">Cancelar</button>
              <button type="button" disabled={delBusy} onClick={excluirAtendimento} className="inline-flex min-h-[40px] items-center rounded-lg bg-[#b3261e] px-4 text-[0.85rem] font-semibold text-white disabled:opacity-60">{delBusy ? 'Excluindo…' : 'Sim, excluir'}</button>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row" onClick={(e) => e.stopPropagation()}>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4" onClick={() => setAberta(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoUrl(aberta.a.fotos[aberta.i].id)} alt="" onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-lg object-contain" />
            {aberta.a.fotos.length > 1 && (
              <>
                <button type="button" aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setAberta({ a: aberta.a, i: (aberta.i - 1 + aberta.a.fotos.length) % aberta.a.fotos.length }); }} className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm">‹</button>
                <button type="button" aria-label="Próxima" onClick={(e) => { e.stopPropagation(); setAberta({ a: aberta.a, i: (aberta.i + 1) % aberta.a.fotos.length }); }} className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm">›</button>
              </>
            )}
          </div>
          <DetalhesFoto a={aberta.a} i={aberta.i} />
          </div>
        </div>
      )}
    </div>
  );
}

const tamanho = (b?: number) => (!b ? '-' : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

/** Painel de informações da foto para o gestor: quem enviou, quando, de onde e de qual aparelho. */
function DetalhesFoto({ a, i }: { a: Atendimento; i: number }) {
  const f = a.fotos[i];
  const aparelho = f.dispositivo ? `${f.dispositivo} · ${f.so} · ${f.navegador}` : 'Não registrado';
  const linhas: [string, string][] = [
    ['Paciente', a.identificador_paciente],
    ['Enviada por', nomeLimpo(a.aluno.nome)],
    ['Matrícula', a.aluno.matricula ?? 'Sem matrícula'],
    ['E-mail', a.aluno.email ?? '-'],
    ['Cidade', a.cidade],
    ['Data e horário', fmtData(f.created_at)],
    ['Dispositivo', aparelho],
    ['Tamanho', tamanho(f.bytes)],
    ['Dimensões', f.width && f.height ? `${f.width} × ${f.height} px` : '-'],
    ['Foto', `${i + 1} de ${a.fotos.length} do atendimento #${a.id}`],
    ['Situação', f.oculta ? 'Excluída pelo aluno' : 'Visível ao aluno'],
  ];
  return (
    <aside className="max-h-[42vh] w-full shrink-0 overflow-y-auto bg-white p-5 text-ink lg:max-h-none lg:w-[340px] lg:rounded-tl-2xl" aria-label="Informações da foto">
      <h4 className="text-[1.05rem] font-bold">Informações da foto</h4>
      <dl className="mt-3 divide-y divide-line">
        {linhas.map(([k, v]) => (
          <div key={k} className="py-2.5"><dt className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink/50">{k}</dt><dd className={`mt-0.5 break-words text-[0.9rem] font-medium ${k === 'Situação' && f.oculta ? 'text-[#b3261e]' : ''}`}>{v}</dd></div>
        ))}
      </dl>
    </aside>
  );
}

export default function AdminPage() {
  const { me, sair, recarregar } = useSession('ADMIN');
  const [config, setConfig] = useState(false);
  if (!me) return <PageLoader />;
  if (config) return <PerfilInicial modo="config" me={me} sair={sair} recarregar={recarregar} onVoltar={() => setConfig(false)} />;
  return <Painel me={me} sair={sair} abrirConfig={() => setConfig(true)} />;
}

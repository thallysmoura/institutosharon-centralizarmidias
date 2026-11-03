'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock, FileText, Link2, Loader2, Megaphone, MapPin, Paperclip, Pencil, Plus, Search, Send, Trash2, UserRound, Users, X } from 'lucide-react';
import { API, api, fmtData } from '@/lib/api';
import type { Anexo } from '@/lib/notificacoes';
import { nomeLimpo } from '@/lib/session';
import EditorTexto from './EditorTexto';
import Spinner from './Spinner';
import AvisoAnexos, { urlAnexo } from './AvisoAnexos';
import { BarrasCidade, RoscaLeitura, SerieLeituras } from './GraficosAviso';

type Dest = { id: number; nome: string; email: string };
type Cid = { id: number; nome: string; usuarios: number };
type Leitor = { id: number; nome: string; foto: string | null };
type Aviso = {
  id: number; titulo: string; corpo: string; para_todos: boolean; para_cidades: number[] | null; created_at: string; editado_em: string | null;
  autor: string | null; autor_foto: string | null; lidos: number; total: number; leitores: Leitor[]; destinatarios: Dest[]; cidades: { id: number; nome: string }[]; anexos: Anexo[];
};
type Usuario = Dest & { role: 'ALUNO' | 'ADMIN'; matricula: string | null };
type Alvo = 'todos' | 'cidades' | 'pessoas';
type Item = {
  k: string; id?: number; tipo: 'arquivo' | 'link'; nome?: string; mime?: string; tamanho?: number; chave?: string; url?: string; titulo?: string; descricao?: string; site?: string;
  previa?: string | null; enviando?: boolean; erro?: string;
};
type Linha = { id: number; nome: string; email: string; role: 'ALUNO' | 'ADMIN'; matricula: string | null; cidade: string | null; foto: string | null; lido_em: string | null; total_filtrado: number };
type Alcance = {
  resumo: { total: number; lidos: number; alunos: number; alunos_lidos: number; admins: number; admins_lidos: number; primeira: string | null; ultima: string | null };
  cidades: { id: number | null; nome: string; total: number; lidos: number }[];
  serie: { gran: 'hour' | 'day'; pontos: { t: string; n: number }[] };
  itens: Linha[];
};

const vazioHtml = (h: string) => !h.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ANEXOS = 10;
const tam = (n?: number | null) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

/** Foto redonda de perfil; sem foto (ou se falhar) mostra a inicial. */
function Foto({ src, nome, size = 32, anel = false }: { src: string | null; nome: string; size?: number; anel?: boolean }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#f6efe0] font-bold text-gold-700 ${anel ? 'ring-2 ring-white' : ''}`} style={{ width: size, height: size, fontSize: size * 0.4 }} title={nomeLimpo(nome)}>
      {src && !falhou ? <img src={`${API}${src}`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFalhou(true)} className="h-full w-full object-cover" /> : nomeLimpo(nome).charAt(0).toUpperCase()}
    </span>
  );
}

/** Formulário de aviso (novo ou edição): título, público (todos, cidades ou pessoas), texto formatado e anexos (PDF, imagens, links com prévia). */
function FormAviso({ inicial, onFechar, onSalvo }: { inicial: Aviso | null; onFechar: () => void; onSalvo: () => void }) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [corpo, setCorpo] = useState(inicial?.corpo ?? '');
  const [alvo, setAlvo] = useState<Alvo>(inicial ? (inicial.para_todos ? 'todos' : inicial.para_cidades ? 'cidades' : 'pessoas') : 'todos');
  const [dest, setDest] = useState<Dest[]>(inicial?.destinatarios ?? []);
  const [cidades, setCidades] = useState<number[]>(inicial?.para_cidades ?? []);
  const [todasCidades, setTodasCidades] = useState<Cid[]>([]);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<Usuario[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [itens, setItens] = useState<Item[]>(() => (inicial?.anexos ?? []).map((a) => ({ k: `a${a.id}`, id: a.id, tipo: a.tipo, nome: a.nome ?? undefined, mime: a.mime ?? undefined, tamanho: a.tamanho ?? undefined, url: a.url ?? undefined, titulo: a.titulo ?? undefined, descricao: a.descricao ?? undefined, site: a.site ?? undefined, previa: a.tipo === 'link' ? (a.imagem ? urlAnexo(a.id) : null) : a.mime?.startsWith('image/') ? urlAnexo(a.id) : null })));
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkErro, setLinkErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => { api<Cid[]>('/admin/avisos/cidades').then(setTodasCidades).catch(() => null); }, []);

  useEffect(() => {
    const t = busca.trim();
    if (t.length < 3) { setAchados([]); return; }
    setBuscando(true);
    const h = setTimeout(() => {
      api<Usuario[]>(`/admin/usuarios/busca?q=${encodeURIComponent(t)}`).then((r) => setAchados(r.filter((u) => !dest.some((d) => d.id === u.id)))).catch(() => setAchados([])).finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(h);
  }, [busca, dest]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onFechar(); };
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, [onFechar, busy]);

  const enviando = itens.some((i) => i.enviando);
  const publicoOk = alvo === 'todos' || (alvo === 'cidades' ? cidades.length > 0 : dest.length > 0);
  const pronto = titulo.trim().length >= 2 && (!vazioHtml(corpo) || itens.some((i) => !i.erro)) && publicoOk && !enviando;
  const total = alvo === 'todos' ? null : alvo === 'cidades' ? todasCidades.filter((c) => cidades.includes(c.id)).reduce((s, c) => s + c.usuarios, 0) : dest.length;

  async function adicionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const novos = Array.from(lista);
    if (arquivo.current) arquivo.current.value = '';
    let vagas = MAX_ANEXOS - itens.length;
    for (const f of novos) {
      if (vagas-- <= 0) { setErro(`No máximo ${MAX_ANEXOS} anexos por aviso.`); break; }
      const k = `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      const base: Item = { k, tipo: 'arquivo', nome: f.name, mime: f.type, tamanho: f.size, previa: f.type.startsWith('image/') ? URL.createObjectURL(f) : null, enviando: true };
      if (!TIPOS.includes(f.type)) { setItens((l) => [...l, { ...base, enviando: false, erro: 'Use PDF, JPEG, PNG ou WebP.' }]); continue; }
      if (f.size > MAX_BYTES) { setItens((l) => [...l, { ...base, enviando: false, erro: 'Máximo de 10 MB.' }]); continue; }
      setItens((l) => [...l, base]);
      const fd = new FormData();
      fd.append('arquivo', f);
      api<{ chave: string; nome: string; mime: string; tamanho: number }>('/admin/avisos/anexos', { method: 'POST', body: fd })
        .then((r) => setItens((l) => l.map((i) => (i.k === k ? { ...i, ...r, enviando: false } : i))))
        .catch((e) => setItens((l) => l.map((i) => (i.k === k ? { ...i, enviando: false, erro: (e as Error).message } : i))));
    }
  }

  async function adicionarLink() {
    let u = link.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    if (itens.length >= MAX_ANEXOS) { setLinkErro(`No máximo ${MAX_ANEXOS} anexos por aviso.`); return; }
    setLinkBusy(true);
    setLinkErro('');
    try {
      const r = await api<{ url: string; titulo: string; descricao: string | null; site: string; chave: string | null; mime: string | null; imagem_data: string | null }>('/admin/avisos/link-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) });
      setItens((l) => [...l, { k: `l${Date.now()}`, tipo: 'link', url: r.url, titulo: r.titulo, descricao: r.descricao ?? undefined, site: r.site, chave: r.chave ?? undefined, mime: r.mime ?? undefined, previa: r.imagem_data }]);
      setLink('');
    } catch (e) {
      setLinkErro((e as Error).message);
    } finally {
      setLinkBusy(false);
    }
  }

  async function salvar() {
    setBusy(true);
    setErro('');
    try {
      const anexos = itens.filter((i) => !i.erro && !i.enviando).map((i) => (i.id ? { id: i.id, tipo: i.tipo } : { tipo: i.tipo, nome: i.nome, mime: i.mime, tamanho: i.tamanho, chave: i.chave, url: i.url, titulo: i.titulo, descricao: i.descricao, site: i.site }));
      const corpoReq = { titulo: titulo.trim(), corpo, alvo, destinatarios: alvo === 'pessoas' ? dest.map((d) => d.id) : [], cidades: alvo === 'cidades' ? cidades : [], anexos };
      await api(inicial ? `/admin/avisos/${inicial.id}` : '/admin/avisos', { method: inicial ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpoReq) });
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
      setBusy(false);
    }
  }

  const opcoes: [Alvo, string, typeof Users, string][] = [['todos', 'Todos', Users, 'Todos os usuários'], ['cidades', 'Por cidade', MapPin, 'Só quem é da cidade'], ['pessoas', 'Pessoas', UserRound, 'Escolher quem recebe']];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={inicial ? 'Editar aviso' : 'Novo aviso'} className="fade-in fixed inset-0 z-[100] flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={() => !busy && onFechar()}>
      <div className="pop flex max-h-[96dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[1.25rem] font-bold">{inicial ? 'Editar aviso' : 'Novo aviso'}</h2>
          <button type="button" onClick={onFechar} disabled={busy} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full text-ink/60 hover:bg-sand"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-[0.78rem] font-semibold text-ink/70">Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Ex.: Reunião geral na sexta" className="field mt-1 !pl-4" />
          </label>

          <div>
            <p className="text-[0.78rem] font-semibold text-ink/70">Enviar para</p>
            <div role="radiogroup" className="mt-1 grid grid-cols-3 gap-2">
              {opcoes.map(([v, r, Icone, sub]) => (
                <button key={v} type="button" role="radio" aria-checked={alvo === v} onClick={() => setAlvo(v)}
                  className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition sm:flex-row sm:items-center sm:gap-2.5 ${alvo === v ? 'border-gold-500 bg-[#fbf5e6] ring-2 ring-gold-500/20' : 'border-line bg-white hover:bg-ivory'}`}>
                  <Icone size={18} className="shrink-0 text-gold-600" /><span className="leading-tight"><b className="block text-[0.86rem]">{r}</b><span className="hidden text-[0.7rem] text-ink/55 sm:block">{sub}</span></span>
                </button>
              ))}
            </div>

            {alvo === 'cidades' && (
              <div className="mt-3">
                <ul className="flex flex-wrap gap-2">
                  {todasCidades.map((c) => {
                    const on = cidades.includes(c.id);
                    return (
                      <li key={c.id}>
                        <button type="button" aria-pressed={on} onClick={() => setCidades((l) => (on ? l.filter((x) => x !== c.id) : [...l, c.id]))}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.82rem] font-semibold transition ${on ? 'border-gold-500 bg-[#fbf5e6] text-gold-700' : 'border-line bg-white text-ink/70 hover:bg-ivory'}`}>
                          {on ? <CheckCircle2 size={14} /> : <MapPin size={14} />}{c.nome}<span className="text-[0.7rem] font-medium text-ink/45">{c.usuarios}</span>
                        </button>
                      </li>
                    );
                  })}
                  {todasCidades.length === 0 && <li className="text-[0.78rem] text-ink/50">Carregando cidades…</li>}
                </ul>
                {cidades.length > 0 && <p className="mt-2 text-[0.76rem] text-ink/55">Chega só para quem tem cadastro nas cidades escolhidas ({total} pessoa(s)).</p>}
              </div>
            )}

            {alvo === 'pessoas' && (
              <div className="mt-3">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa (3+ letras: nome, e-mail ou matrícula)" aria-label="Buscar pessoa" className="field-plain !pl-9" />
                  {busca.trim().length >= 3 && (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-soft">
                      {buscando && <li className="px-3 py-2.5 text-[0.82rem] text-ink/55">Buscando…</li>}
                      {!buscando && achados.length === 0 && <li className="px-3 py-2.5 text-[0.82rem] text-ink/55">Ninguém encontrado.</li>}
                      {achados.map((u) => (
                        <li key={u.id}><button type="button" onClick={() => { setDest((d) => [...d, { id: u.id, nome: u.nome, email: u.email }]); setBusca(''); }} className="block w-full px-3 py-2 text-left hover:bg-ivory">
                          <span className="text-[0.88rem] font-semibold">{nomeLimpo(u.nome)}</span><span className="block text-[0.72rem] text-ink/55">{u.email}{u.role === 'ADMIN' ? ' · administrador' : ''}</span>
                        </button></li>
                      ))}
                    </ul>
                  )}
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {dest.map((d) => (
                    <li key={d.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#f6efe0] py-1 pl-3 pr-1.5 text-[0.78rem] font-medium text-[#6b5a3c]">{nomeLimpo(d.nome)}
                      <button type="button" onClick={() => setDest((l) => l.filter((x) => x.id !== d.id))} aria-label={`Remover ${d.nome}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-white"><X size={12} /></button>
                    </li>
                  ))}
                  {dest.length === 0 && <li className="text-[0.78rem] text-ink/50">Nenhuma pessoa escolhida ainda.</li>}
                </ul>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 text-[0.78rem] font-semibold text-ink/70">Mensagem</p>
            <EditorTexto valor={corpo} onChange={setCorpo} />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.78rem] font-semibold text-ink/70">Anexos <span className="font-normal text-ink/45">(PDF, imagens e links)</span></p>
              <button type="button" onClick={() => arquivo.current?.click()} disabled={itens.length >= MAX_ANEXOS} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[0.8rem] font-semibold text-ink/75 transition hover:bg-ivory disabled:opacity-50"><Paperclip size={15} />Anexar arquivo</button>
              <input ref={arquivo} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => adicionarArquivos(e.target.files)} />
            </div>
            <div className="mt-2 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
                <input value={link} onChange={(e) => { setLink(e.target.value); setLinkErro(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarLink(); } }} placeholder="Colar um link (https://...)" aria-label="Link" inputMode="url" className="field-plain !pl-9" />
              </div>
              <button type="button" onClick={adicionarLink} disabled={!link.trim() || linkBusy} className="inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-[0.82rem] font-semibold text-white transition hover:brightness-125 disabled:opacity-50">{linkBusy ? <Spinner size={15} /> : <Plus size={15} />}Adicionar</button>
            </div>
            {linkErro && <p role="alert" className="mt-1.5 text-[0.78rem] font-medium text-[#b3261e]">{linkErro}</p>}

            {itens.length > 0 && (
              <ul className="mt-3 space-y-2">
                {itens.map((i) => (
                  <li key={i.k} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${i.erro ? 'border-[#f0c5c0] bg-[#fdf0ee]' : 'border-line bg-white'}`}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-sand text-ink/50">
                      {i.previa ? <img src={i.previa} alt="" className="h-full w-full object-cover" /> : i.tipo === 'link' ? <Link2 size={18} /> : <FileText size={18} />}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <b className="block truncate text-[0.84rem]">{i.tipo === 'link' ? i.titulo : i.nome}</b>
                      <span className={`block truncate text-[0.72rem] ${i.erro ? 'font-medium text-[#b3261e]' : 'text-ink/50'}`}>{i.erro ?? (i.enviando ? 'Enviando…' : i.tipo === 'link' ? i.site ?? i.url : `${i.mime === 'application/pdf' ? 'PDF' : 'Imagem'} · ${tam(i.tamanho)}`)}</span>
                    </span>
                    {i.enviando ? <Loader2 size={18} className="animate-spin text-gold-600" /> : <button type="button" onClick={() => setItens((l) => l.filter((x) => x.k !== i.k))} aria-label="Remover anexo" className="grid h-8 w-8 place-items-center rounded-full text-ink/55 hover:bg-sand"><X size={16} /></button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {erro && <p role="alert" className="rounded-xl bg-[#fdf0ee] px-3 py-2 text-[0.82rem] font-medium text-[#b3261e]">{erro}</p>}
        </div>

        <div className="flex gap-2.5 border-t border-line px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onFechar} disabled={busy} className="btn btn-line !min-h-[46px] !px-5">Cancelar</button>
          <button type="button" onClick={salvar} disabled={!pronto || busy} className="btn btn-gold !min-h-[46px] flex-1 !gap-2">{busy || enviando ? <Spinner size={16} /> : <Send size={16} />}{enviando ? 'Enviando anexos…' : inicial ? 'Salvar alterações' : 'Enviar aviso'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Alcance do aviso: resumo, gráficos e lista de quem recebeu (busca, status e cidade), carregada por páginas. */
function AlcanceAviso({ aviso, onFechar }: { aviso: Aviso; onFechar: () => void }) {
  const [dados, setDados] = useState<Alcance | null>(null);
  const [itens, setItens] = useState<Linha[]>([]);
  const [totalFiltro, setTotalFiltro] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'todos' | 'lidos' | 'pendentes'>('todos');
  const [cidade, setCidade] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [maisBusy, setMaisBusy] = useState(false);
  const [erro, setErro] = useState('');
  const pedido = useRef(0);

  const consulta = useCallback((pg: number) => `/admin/avisos/${aviso.id}/alcance?q=${encodeURIComponent(q.trim())}&status=${status}&cidade=${cidade}&pagina=${pg}`, [aviso.id, q, status, cidade]);

  useEffect(() => {
    const n = ++pedido.current;
    setCarregando(true);
    const h = setTimeout(() => {
      api<Alcance>(consulta(0)).then((r) => {
        if (n !== pedido.current) return;
        setDados(r);
        setItens(r.itens);
        setTotalFiltro(r.itens[0]?.total_filtrado ?? 0);
        setErro('');
      }).catch((e) => { if (n === pedido.current) setErro((e as Error).message); }).finally(() => { if (n === pedido.current) setCarregando(false); });
    }, q ? 300 : 0);
    return () => clearTimeout(h);
  }, [consulta, q]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, [onFechar]);

  async function mais() {
    setMaisBusy(true);
    try { const r = await api<{ itens: Linha[] }>(consulta(Math.floor(itens.length / 30))); setItens((l) => [...l, ...r.itens]); } finally { setMaisBusy(false); }
  }

  const r = dados?.resumo;
  const pct = r?.total ? Math.round((r.lidos / r.total) * 100) : 0;
  const kpis: [string, string | number, string][] = r ? [['Destinatários', r.total, ''], ['Leram', r.lidos, `${pct}%`], ['Pendentes', Math.max(0, r.total - r.lidos), ''], ['Primeira leitura', r.primeira ? fmtData(r.primeira) : '-', '']] : [];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Alcance do aviso" className="fade-in fixed inset-0 z-[100] flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={onFechar}>
      <div className="pop flex max-h-[96dvh] w-full max-w-[860px] flex-col overflow-hidden rounded-t-3xl bg-page shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-gold-700">Alcance do aviso</p>
            <h2 className="truncate text-[1.2rem] font-bold">{aviso.titulo}</h2>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-sand"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!dados && carregando && <div className="space-y-3" aria-hidden><div className="skeleton h-20" /><div className="skeleton h-40" /><div className="skeleton h-52" /></div>}
          {erro && <p role="alert" className="rounded-xl bg-[#fdf0ee] px-3 py-2 text-[0.82rem] font-medium text-[#b3261e]">{erro}</p>}

          {dados && r && (
            <>
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {kpis.map(([l, v, sub]) => (
                  <li key={l} className="card px-3.5 py-3"><p className="text-[0.72rem] font-semibold text-ink/55">{l}</p><p className="mt-0.5 text-[1.35rem] font-bold leading-tight">{typeof v === 'number' ? v.toLocaleString('pt-BR') : v}{sub && <span className="ml-1.5 text-[0.8rem] font-semibold text-gold-700">{sub}</span>}</p></li>
                ))}
              </ul>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <section className="card p-4"><h3 className="mb-3 text-[0.9rem] font-bold">Leitura</h3><RoscaLeitura lidos={r.lidos} total={r.total} />
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.76rem] text-ink/60"><span>Alunos: <b className="text-ink">{r.alunos_lidos}/{r.alunos}</b></span><span>Administradores: <b className="text-ink">{r.admins_lidos}/{r.admins}</b></span></p>
                </section>
                <section className="card p-4"><h3 className="mb-3 text-[0.9rem] font-bold">Evolução das leituras</h3><SerieLeituras pontos={dados.serie.pontos} gran={dados.serie.gran} /></section>
                <section className="card p-4 md:col-span-2"><h3 className="mb-3 text-[0.9rem] font-bold">Leitura por cidade</h3><BarrasCidade itens={dados.cidades} /></section>
              </div>

              <section className="card mt-3 p-4">
                <h3 className="text-[0.9rem] font-bold">Quem recebeu</h3>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou matrícula" aria-label="Buscar" className="field-plain !pl-9" />
                  </div>
                  <select value={cidade} onChange={(e) => setCidade(e.target.value)} aria-label="Cidade" className="field-plain sm:w-[180px]">
                    <option value="">Todas as cidades</option>
                    {dados.cidades.filter((c) => c.id != null).map((c) => <option key={c.id} value={c.id as number}>{c.nome}</option>)}
                  </select>
                </div>
                <div role="tablist" className="mt-2.5 flex gap-1.5">
                  {([['todos', 'Todos'], ['lidos', 'Leram'], ['pendentes', 'Pendentes']] as const).map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={status === k} onClick={() => setStatus(k)} className={`rounded-full px-3.5 py-1.5 text-[0.8rem] font-semibold transition ${status === k ? 'bg-[#f6efe0] text-gold-700' : 'text-ink/60 hover:bg-sand'}`}>{l}</button>
                  ))}
                  <span className="ml-auto self-center text-[0.74rem] text-ink/50">{totalFiltro.toLocaleString('pt-BR')} resultado(s)</span>
                </div>

                <ul className={`mt-2 divide-y divide-line/70 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
                  {itens.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 py-2.5">
                      <Foto src={u.foto} nome={u.nome} size={38} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <b className="block truncate text-[0.88rem]">{nomeLimpo(u.nome)}{u.role === 'ADMIN' && <span className="ml-1.5 text-[0.68rem] font-semibold text-gold-700">ADM</span>}</b>
                        <span className="block truncate text-[0.72rem] text-ink/55">{[u.matricula, u.cidade, u.email].filter(Boolean).join(' · ')}</span>
                      </span>
                      {u.lido_em ? <span className="badge badge-ok shrink-0"><CheckCircle2 size={13} />{fmtData(u.lido_em)}</span> : <span className="badge badge-neutro shrink-0"><Clock size={13} />Pendente</span>}
                    </li>
                  ))}
                  {!carregando && itens.length === 0 && <li className="py-8 text-center text-[0.85rem] text-ink/50">Ninguém encontrado com esses filtros.</li>}
                </ul>
                {itens.length < totalFiltro && <button type="button" onClick={mais} disabled={maisBusy} className="btn btn-line mx-auto mt-3 !min-h-[40px] !px-5 !text-[0.85rem]">{maisBusy ? <Spinner size={15} /> : null}Carregar mais</button>}
              </section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Mural de avisos: histórico com alcance (quem leu), novo aviso (todos, por cidade ou pessoas) com anexos, editar e excluir. */
export default function MuralAvisos() {
  const [lista, setLista] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<Aviso | 'novo' | null>(null);
  const [alcance, setAlcance] = useState<Aviso | null>(null);
  const [apagar, setApagar] = useState<Aviso | null>(null);
  const [apagando, setApagando] = useState(false);
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(() => api<Aviso[]>('/admin/avisos').then(setLista).catch(() => null).finally(() => setCarregando(false)), []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 4000); return () => clearTimeout(t); }, [aviso]);

  async function excluir() {
    if (!apagar) return;
    setApagando(true);
    try { await api(`/admin/avisos/${apagar.id}`, { method: 'DELETE' }); setApagar(null); await carregar(); setAviso('Aviso excluído.'); } finally { setApagando(false); }
  }

  const publico = (a: Aviso) => (a.para_todos ? 'Todos' : a.para_cidades ? a.cidades.map((c) => c.nome).join(', ') : a.destinatarios.map((d) => nomeLimpo(d.nome).split(' ')[0]).slice(0, 3).join(', ') + (a.destinatarios.length > 3 ? ` +${a.destinatarios.length - 3}` : ''));

  return (
    <div className="mt-5 sm:mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.85rem] text-ink/60">Cada aviso publicado vira notificação para os destinatários. Toque em um aviso para ver quem leu.</p>
        <button type="button" onClick={() => setForm('novo')} className="btn btn-gold !min-h-[44px] !gap-2 !px-4"><Plus size={18} />Novo aviso</button>
      </div>
      {aviso && <p role="status" className="pop mt-3 rounded-xl bg-[#e7f6ee] px-3 py-2.5 text-[0.82rem] font-medium text-[#17794a]">{aviso}</p>}

      {carregando && <div className="mt-4 space-y-3" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>}
      {!carregando && lista.length === 0 && (
        <div className="card mt-4 grid place-items-center px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Megaphone size={22} /></span>
          <p className="mt-3 font-semibold">Nenhum aviso publicado</p>
          <p className="text-[0.85rem] text-ink/55">Toque em <b>Novo aviso</b> para falar com todos, com uma cidade ou com pessoas específicas.</p>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {lista.map((a) => {
          const pct = a.total ? Math.min(100, Math.round((a.lidos / a.total) * 100)) : 0;
          const extra = Math.max(0, a.lidos - 5);
          return (
            <li key={a.id} role="button" tabIndex={0} aria-label={`Ver alcance de ${a.titulo}`} onClick={() => setAlcance(a)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setAlcance(a); } }}
              className="card cursor-pointer p-4 transition hover:border-gold-500/50 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/20 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Foto src={a.autor_foto} nome={a.autor ?? '?'} size={40} />
                  <div className="min-w-0">
                    <h3 className="text-[1.02rem] font-bold leading-snug">{a.titulo}</h3>
                    <p className="mt-0.5 text-[0.74rem] text-ink/50">{a.autor ? `${nomeLimpo(a.autor)} · ` : ''}{fmtData(a.created_at)}{a.editado_em ? ' · editado' : ''}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => setForm(a)} aria-label="Editar aviso" title="Editar" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink/70 transition hover:bg-ivory"><Pencil size={16} /></button>
                  <button type="button" onClick={() => setApagar(a)} aria-label="Excluir aviso" title="Excluir" className="grid h-9 w-9 place-items-center rounded-lg border border-[#b3261e]/40 text-[#b3261e] transition hover:bg-[#fdf0ee]"><Trash2 size={16} /></button>
                </div>
              </div>
              {!vazioHtml(a.corpo) && <div className="aviso-html mt-2.5 line-clamp-4 text-[0.88rem] leading-relaxed text-ink/80" dangerouslySetInnerHTML={{ __html: a.corpo }} />}
              {a.anexos.length > 0 && <div onClick={(e) => e.stopPropagation()}><AvisoAnexos anexos={a.anexos} /></div>}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.74rem]">
                <span className="badge max-w-full bg-[#f6efe0] text-[#6b5a3c]">{a.para_todos ? <Users size={13} /> : a.para_cidades ? <MapPin size={13} /> : <UserRound size={13} />}<span className="truncate">{publico(a)}</span></span>
                {a.anexos.length > 0 && <span className="badge badge-neutro"><Paperclip size={13} />{a.anexos.length}</span>}
                <span className="ml-auto flex items-center gap-2.5">
                  {a.leitores.length > 0 && (
                    <span className="flex items-center" aria-label="Quem leu por último">
                      <span className="flex -space-x-2">{a.leitores.slice(0, 5).map((l) => <Foto key={l.id} src={l.foto} nome={l.nome} size={26} anel />)}</span>
                      {extra > 0 && <span className="ml-1.5 text-[0.72rem] font-semibold text-ink/55">+{extra}</span>}
                    </span>
                  )}
                  <span className="text-ink/65"><b className="text-ink">{a.lidos}</b> de {a.total} leram</span>
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#f1ece1]" aria-hidden><div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#a67c26,#e7b23c)' }} /></div>
            </li>
          );
        })}
      </ul>

      {form && <FormAviso key={form === 'novo' ? 'novo' : form.id} inicial={form === 'novo' ? null : form} onFechar={() => setForm(null)} onSalvo={async () => { const edit = form !== 'novo'; setForm(null); await carregar(); setAviso(edit ? 'Aviso atualizado.' : 'Aviso enviado. Os destinatários foram notificados.'); }} />}
      {alcance && <AlcanceAviso key={alcance.id} aviso={alcance} onFechar={() => setAlcance(null)} />}

      {apagar && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Excluir aviso" className="fade-in fixed inset-0 z-[110] grid place-items-center bg-ink/60 p-4" onClick={() => !apagando && setApagar(null)}>
          <div className="pop w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#fdf0ee] text-[#b3261e]"><Trash2 size={20} /></span>
            <h3 className="mt-3 text-[1.15rem] font-bold">Excluir este aviso?</h3>
            <p className="mt-1 text-[0.88rem] text-ink/65">&quot;{apagar.titulo}&quot; deixa de aparecer nas notificações dos destinatários e os anexos são apagados. Essa ação fica registrada na auditoria.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={apagando} onClick={() => setApagar(null)} className="btn btn-line !min-h-[40px] !rounded-lg !px-4 !text-[0.85rem]">Cancelar</button>
              <button type="button" disabled={apagando} onClick={excluir} className="inline-flex min-h-[40px] items-center rounded-lg bg-[#b3261e] px-4 text-[0.85rem] font-semibold text-white disabled:opacity-60">{apagando ? 'Excluindo…' : 'Sim, excluir'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

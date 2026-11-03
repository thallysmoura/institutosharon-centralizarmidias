'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronsUpDown, Search, Download, Pencil, Menu, X, Trash2, Settings, Camera, CheckCircle2, GraduationCap, History, ImageIcon, Info, LogOut, MapPin, PlusCircle, User } from 'lucide-react';
import { api, Atendimento, fmtData, fotoUrl, Me } from '@/lib/api';
import { fmtDia, nomeLimpo, useSession } from '@/lib/session';
import Titulo from '@/components/Titulo';
import { Wordmark } from '@/components/Brand';
import PerfilInicial from '@/components/PerfilInicial';
import { createPortal } from 'react-dom';
import Avatar, { Ampliada } from '@/components/Avatar';
import PageLoader from '@/components/PageLoader';
import CameraCaptura from '@/components/CameraCaptura';
import Notificacoes from '@/components/Notificacoes';

type Item = { file: File; url: string };
type Aba = 'inicio' | 'historico';

const MAX = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

function Envio({ me, sair, recarregar, abrirConfig }: { me: Me; sair: () => void; recarregar: () => void; abrirConfig: () => void }) {
  const [aba, setAba] = useState<Aba>('inicio');
  const [menuNovo, setMenuNovo] = useState(false);
  const aberturaMenu = useRef(0);
  // Abre o menu de envio; um toque "fantasma" logo após abrir (ao trocar de aba) não pode fechá-lo.
  const abrirMenuNovo = () => { aberturaMenu.current = Date.now(); setMenuNovo(true); };
  const [camAberta, setCamAberta] = useState(false);
  const [det, setDet] = useState<number | null>(null); // posição na grade da foto aberta no modal
  const [editando, setEditando] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState('');
  const [menuMovel, setMenuMovel] = useState(false);
  const [menuTopo, setMenuTopo] = useState(false);
  const [menuRodape, setMenuRodape] = useState(false);
  const [buscaMenu, setBuscaMenu] = useState('');
  const buscaRef = useRef<HTMLInputElement>(null);
  const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const termo = semAcento(buscaMenu.trim());
  // Sem busca: Novo envio e Histórico; com busca: também Configurações.
  const ITENS = [['inicio', 'Novo envio', PlusCircle], ['historico', 'Histórico', History], ['config', 'Configurações', Settings]] as const;
  const itensMenu = ITENS.filter(([k, l]) => (termo ? semAcento(l).includes(termo) : k !== 'config'));
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) { e.preventDefault(); setMenuMovel(true); buscaRef.current?.focus(); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  function irPara(k: 'inicio' | 'historico' | 'config') {
    setBuscaMenu('');
    setMenuMovel(false);
    if (k === 'config') return abrirConfig();
    setAba(k);
    if (k === 'inicio' && window.matchMedia('(min-width: 1024px)').matches) abrirMenuNovo(); // no celular o menu de envio fica só no rodapé
  }
  useEffect(() => {
    if (!menuRodape) return;
    const fecha = (e: Event) => { if (!(e.target as HTMLElement).closest('[data-menu-rodape]')) setMenuRodape(false); };
    document.addEventListener('mousedown', fecha); document.addEventListener('touchstart', fecha);
    return () => { document.removeEventListener('mousedown', fecha); document.removeEventListener('touchstart', fecha); };
  }, [menuRodape]);
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
    if (!menuTopo) return;
    const fecha = (e: Event) => { if (!(e.target as HTMLElement).closest('[data-menu-topo]')) setMenuTopo(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuTopo(false); };
    document.addEventListener('mousedown', fecha); document.addEventListener('touchstart', fecha); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fecha); document.removeEventListener('touchstart', fecha); document.removeEventListener('keydown', esc); };
  }, [menuTopo]);
  const [ver, setVer] = useState<{ a: Atendimento; i: number } | null>(null);
  const [apagar, setApagar] = useState<number | null>(null); // id da foto em confirmação de exclusão
  const [apagando, setApagando] = useState(false);
  const [ident, setIdent] = useState('');
  const [itens, setItens] = useState<Item[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [meus, setMeus] = useState<Atendimento[]>([]);
  const galeria = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const identRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => api<Atendimento[]>('/atendimentos/meus').then(setMeus).catch(() => null), []);
  useEffect(() => { carregar(); }, [carregar]);

  function adicionar(lista: FileList | File[] | null) {
    if (!lista) return;
    const novos: Item[] = [];
    let aviso = '';
    for (const f of Array.from(lista)) {
      if (!TIPOS.includes(f.type)) aviso = 'Use imagens JPEG, PNG ou WebP.';
      else if (f.size > MAX_BYTES) aviso = 'Cada foto deve ter no máximo 10 MB.';
      else if (itens.length + novos.length >= MAX) aviso = `Máximo de ${MAX} fotos por envio.`;
      else novos.push({ file: f, url: URL.createObjectURL(f) });
    }
    setItens((v) => [...v, ...novos]);
    setMsg(aviso ? { ok: false, texto: aviso } : null);
  }

  const remover = (i: number) => setItens((v) => { URL.revokeObjectURL(v[i].url); return v.filter((_, k) => k !== i); });

  async function enviar() {
    setEnviando(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('identificador', ident.trim());
      itens.forEach((i) => fd.append('fotos', i.file));
      const r = await api<{ enviadas: number }>('/atendimentos', { method: 'POST', body: fd });
      itens.forEach((i) => URL.revokeObjectURL(i.url));
      setItens([]);
      setMsg({ ok: true, texto: `${r.enviadas} foto(s) enviada(s) com sucesso.` });
      carregar();
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message || 'Não foi possível enviar. Tente novamente.' });
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    if (!msg?.ok) return;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);
  useEffect(() => {
    if (!menuNovo) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuNovo(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [menuNovo]);

  const cancelarEnvio = () => { itens.forEach((i) => URL.revokeObjectURL(i.url)); setItens([]); setIdent(''); setMsg(null); };
  const pronto = ident.trim().length >= 2 && itens.length > 0 && !enviando;
  const primeiro = nomeLimpo(me.nome).split(' ')[0];

  // Todas as fotos (mais novas primeiro), cada uma com o atendimento a que pertence.
  const todas = meus.flatMap((a) => a.fotos.map((f) => ({ a, f })));
  const grade = aba === 'inicio' ? todas.slice(0, 12) : todas;
  const atual = det != null ? todas[det] : null;

  function abrirDetalhe(id: number) {
    setDet(todas.findIndex((x) => x.f.id === id));
    setEditando(false);
    setErroNome('');
  }
  async function salvarNome() {
    if (!atual) return;
    const nome = novoNome.trim();
    if (nome.length < 2) return setErroNome('Informe ao menos 2 caracteres.');
    setSalvandoNome(true);
    setErroNome('');
    try {
      await api(`/atendimentos/${atual.a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identificador: nome }) });
      await carregar();
      setEditando(false);
    } catch (e) {
      setErroNome((e as Error).message);
    } finally {
      setSalvandoNome(false);
    }
  }
  const tam = (b?: number) => (!b ? '-' : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

  const painelEnvios = (
    <section key={aba} className={`fade-in flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-white p-4 shadow-card lg:col-span-2 lg:p-5`}>
      <div className="flex shrink-0 items-center justify-between">
        <Titulo icone={History}>{aba === 'inicio' ? 'Recentes' : 'Histórico de envios'}</Titulo>
        <div className="flex shrink-0 items-center gap-3">
          {aba === 'inicio' && meus.length > 0 && <button type="button" onClick={() => setAba('historico')} className="text-[0.8rem] font-semibold text-gold-600">Ver todos ({meus.length})</button>}
        </div>
      </div>
      {msg?.ok && <p role="status" className="pop mt-3 flex items-center gap-2 rounded-xl bg-[#e7f6ee] px-3 py-2.5 text-[0.82rem] font-medium text-[#17794a]"><CheckCircle2 size={16} className="shrink-0" />{msg.texto}</p>}
      {meus.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-[0.85rem] text-ink/50">
          <div><span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><ImageIcon size={20} /></span>Nenhum envio ainda.<br />Toque em <b>Novo envio</b> para começar.</div>
        </div>
      ) : (
        <ul className="mt-4 grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto sm:grid-cols-4 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6">
          {grade.map(({ a, f }) => (
            <li key={f.id}>
              <button type="button" onClick={() => abrirDetalhe(f.id)} aria-label={`Ver foto de ${a.identificador_paciente}`} className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-sand shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoUrl(f.id, true)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-left text-white">
                  <span className="block truncate text-[0.72rem] font-semibold">{a.identificador_paciente}</span>
                  <span className="block truncate text-[0.62rem] text-white/80">{fmtDia(f.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  /** Detalhes da foto: informações, editar nome do paciente, baixar e excluir (só some para o aluno). */
  const modalDetalhe = atual && (
    <div role="dialog" aria-modal="true" aria-label="Detalhes da foto" className="fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={() => setDet(null)}>
      <div className="pop flex max-h-[94dvh] w-full max-w-[860px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl lg:flex-row" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex min-h-[220px] flex-1 items-center justify-center bg-[#21180D]">
          <button type="button" onClick={() => setVer({ a: atual.a, i: Math.max(0, atual.a.fotos.findIndex((x) => x.id === atual.f.id)) })} aria-label="Ampliar foto" className="block h-full w-full cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoUrl(atual.f.id)} alt="" className="mx-auto max-h-[46dvh] w-full object-contain lg:max-h-[78dvh]" />
          </button>
          {todas.length > 1 && (
            <>
              <button type="button" aria-label="Anterior" onClick={() => { setDet((det! - 1 + todas.length) % todas.length); setEditando(false); }} className="absolute left-2 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm">‹</button>
              <button type="button" aria-label="Próxima" onClick={() => { setDet((det! + 1) % todas.length); setEditando(false); }} className="absolute right-2 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm">›</button>
            </>
          )}
        </div>
        <div className="flex min-h-0 w-full flex-col overflow-y-auto p-5 lg:w-[330px] lg:shrink-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[1.15rem] font-bold leading-tight">Detalhes da foto</h2>
            <button type="button" onClick={() => setDet(null)} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-xl leading-none">×</button>
          </div>

          <div className="mt-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink/50">Paciente</p>
            {editando ? (
              <div className="mt-1">
                <input autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') salvarNome(); if (e.key === 'Escape') setEditando(false); }} maxLength={80} aria-label="Nome do paciente" className="field !h-[46px]" />
                <p className="mt-1.5 text-[0.72rem] text-ink/55">Altera o nome em todas as fotos deste atendimento.</p>
                {erroNome && <p role="alert" className="mt-1.5 text-[0.78rem] font-medium text-[#b3261e]">{erroNome}</p>}
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={() => setEditando(false)} disabled={salvandoNome} className="btn btn-line !min-h-[42px] flex-1">Cancelar</button>
                  <button type="button" onClick={salvarNome} disabled={salvandoNome || novoNome.trim() === atual.a.identificador_paciente || novoNome.trim().length < 2} className="btn btn-gold !min-h-[42px] flex-1">{salvandoNome ? 'Salvando…' : 'Salvar'}</button>
                </div>
              </div>
            ) : (
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="break-words text-[1.05rem] font-semibold">{atual.a.identificador_paciente}</p>
                <button type="button" onClick={() => { setNovoNome(atual.a.identificador_paciente); setEditando(true); setErroNome(''); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[0.78rem] font-semibold text-gold-700 transition hover:bg-ivory"><Pencil size={14} />Editar</button>
              </div>
            )}
          </div>

          <dl className="mt-3 divide-y divide-line">
            {([
              ['Enviada em', fmtData(atual.f.created_at)],
              ['Cidade', atual.a.cidade],
              ['Dispositivo', atual.f.dispositivo ? `${atual.f.dispositivo} · ${atual.f.so} · ${atual.f.navegador}` : 'Não registrado'],
              ['Tamanho', tam(atual.f.bytes)],
              ['Dimensões', atual.f.width && atual.f.height ? `${atual.f.width} × ${atual.f.height} px` : '-'],
              ['Foto', `${atual.a.fotos.findIndex((x) => x.id === atual.f.id) + 1} de ${atual.a.fotos.length} deste atendimento`],
            ] as const).map(([k, v]) => <div key={k} className="py-2"><dt className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink/50">{k}</dt><dd className="mt-0.5 break-words text-[0.88rem] font-medium">{v}</dd></div>)}
          </dl>

          <div className="mt-auto flex gap-2.5 pt-4">
            <a href={`${fotoUrl(atual.f.id)}?download=1`} className="btn btn-line !min-h-[46px] flex-1 !gap-2"><Download size={17} />Baixar</a>
            <button type="button" onClick={() => setApagar(atual.f.id)} className="btn !min-h-[46px] flex-1 !gap-2 border border-[#b3261e]/40 bg-white text-[#b3261e] hover:bg-[#fdf0ee]"><Trash2 size={17} />Excluir</button>
          </div>
          <p className="mt-2.5 text-[0.7rem] leading-snug text-ink/50">Excluir remove a foto só para você. A administração mantém o registro.</p>
        </div>
      </div>
    </div>
  );

  /** Menu do "Novo envio": câmera ou arquivos do aparelho. */
  const menuNovoUI = menuNovo && (
    <>
      <div className="fade-in fixed inset-0 z-[55] bg-black/45" onClick={() => { if (Date.now() - aberturaMenu.current > 400) setMenuNovo(false); }} aria-hidden />
      <div role="menu" aria-label="Novo envio" className="pop fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[56] mx-auto max-w-[380px] overflow-hidden rounded-2xl bg-white p-2 shadow-[0_24px_60px_-20px_rgba(33,24,13,.6)] lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-[7.5rem] lg:-translate-x-1/2">
        <p className="px-3 pb-1 pt-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink/45">Novo envio</p>
        <button type="button" role="menuitem" onClick={() => { setMenuNovo(false); if (typeof navigator.mediaDevices?.getUserMedia === 'function') setCamAberta(true); else camera.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition hover:bg-ivory active:scale-[0.99]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)' }}><Camera size={22} strokeWidth={1.6} /></span>
          <span className="leading-tight"><b className="block text-[0.95rem]">Tirar foto</b><span className="text-[0.78rem] text-ink/55">Abrir a câmera do aparelho</span></span>
        </button>
        <button type="button" role="menuitem" onClick={() => { setMenuNovo(false); galeria.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition hover:bg-ivory active:scale-[0.99]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><ImageIcon size={22} strokeWidth={1.6} /></span>
          <span className="leading-tight"><b className="block text-[0.95rem]">Enviar do dispositivo</b><span className="text-[0.78rem] text-ink/55">Escolher fotos da galeria ou arquivos</span></span>
        </button>
      </div>
    </>
  );

  /** Folha de confirmação: aparece quando há fotos escolhidas; pede o paciente e envia. */
  const folhaEnvio = itens.length > 0 && (
    <div role="dialog" aria-modal="true" aria-label="Enviar fotos" className="fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={() => !enviando && cancelarEnvio()}>
      <div className="pop w-full max-w-[460px] rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.35rem] font-bold leading-none">Enviar <span className="italic text-gold-600">fotos</span></h2>
          <span className="text-[0.72rem] font-semibold text-ink/45">{itens.length}/{MAX}</span>
        </div>
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {itens.map((i, k) => (
            <li key={i.url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt={`Pré-visualização ${k + 1}`} className="h-full w-full object-cover" />
              <button type="button" disabled={enviando} onClick={() => remover(k)} aria-label="Remover foto" className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink/75 text-[0.8rem] leading-none text-white">×</button>
            </li>
          ))}
          {itens.length < MAX && <li className="shrink-0"><button type="button" disabled={enviando} onClick={() => galeria.current?.click()} aria-label="Adicionar mais fotos" className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-gold-500/60 text-gold-600 transition hover:bg-ivory"><PlusCircle size={22} strokeWidth={1.6} /></button></li>}
        </ul>
        <div className="relative mt-3">
          <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
          <input ref={identRef} autoFocus aria-label="Identificador do paciente" value={ident} onChange={(e) => setIdent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && pronto) enviar(); }} maxLength={80} placeholder="Paciente (ex.: P-4587)" className="field !mt-0" />
        </div>
        {msg && !msg.ok && <p role="alert" className="mt-2.5 rounded-xl bg-[#fdf0ee] px-3 py-2 text-[0.8rem] font-medium text-[#b3261e]">{msg.texto}</p>}
        <div className="mt-3 flex gap-2.5">
          <button type="button" disabled={enviando} onClick={cancelarEnvio} className="btn btn-line !min-h-[48px] shrink-0 !px-5">Cancelar</button>
          <button type="button" onClick={enviar} disabled={!pronto} className="btn btn-gold !min-h-[48px] flex-1">
            {enviando ? 'Enviando…' : `Enviar ${itens.length} foto${itens.length === 1 ? '' : 's'}`}
          </button>
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[0.7rem] text-ink/50"><Info size={13} className="shrink-0" />As fotos são organizadas e centralizadas pelo Instituto Sharon.</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page lg:flex-row">
      {/* Celular: cabeçalho compacto com hambúrguer, logo e menu do usuário (igual ao painel do administrador) */}
      <header className="relative z-30 order-1 flex shrink-0 items-center justify-between bg-side px-4 py-3 text-white lg:hidden">
        <button type="button" onClick={() => setMenuMovel(true)} aria-label="Abrir menu" aria-expanded={menuMovel} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10"><Menu size={24} /></button>
        <button type="button" onClick={() => setAba('inicio')} aria-label="Ir para o início" className="select-none"><Wordmark light /></button>
        <div className="flex items-center gap-2.5">
        <Notificacoes lugar="topo" />
        <div data-menu-topo className="relative">
          <button type="button" onClick={() => setMenuTopo((v) => !v)} aria-haspopup="menu" aria-expanded={menuTopo} aria-label="Menu do usuário" className="block rounded-full">
            {me.foto_url ? <Avatar foto={me.foto_url} size={36} semBorda /> : <span className="grid h-9 w-9 place-items-center rounded-full text-[0.9rem] font-bold" style={{ background: 'linear-gradient(180deg,#d9b655,#a67c26)' }}>{primeiro.charAt(0)}</span>}
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
      <aside aria-label="Menu lateral" className={`fixed inset-y-0 left-0 z-50 flex w-[290px] max-w-[85vw] flex-col bg-side text-white shadow-2xl transition-[transform,visibility] duration-300 ease-out lg:static lg:z-auto lg:h-dvh lg:w-[256px] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:visible lg:shadow-none ${menuMovel ? 'translate-x-0' : 'invisible -translate-x-full'}`}>
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <Wordmark light />
          <span className="hidden lg:block"><Notificacoes lugar="menu" /></span>
          <button type="button" onClick={() => setMenuMovel(false)} aria-label="Fechar menu" className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10 lg:hidden"><X size={22} /></button>
        </div>
        <div className="relative px-4 pb-3">
          <Search size={17} className="pointer-events-none absolute left-7 top-1/2 -translate-y-[calc(50%+6px)] text-white/55" aria-hidden />
          <input ref={buscaRef} value={buscaMenu} onChange={(e) => setBuscaMenu(e.target.value)} aria-label="Buscar no menu" placeholder="Buscar no menu..." autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setBuscaMenu(''); e.currentTarget.blur(); }
              if (e.key === 'Enter' && itensMenu[0]) { irPara(itensMenu[0][0]); e.currentTarget.blur(); }
            }}
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] py-2.5 pl-10 pr-10 text-[0.88rem] text-white outline-none transition placeholder:text-white/50 focus:border-[#c9a24a] focus:bg-white/10" />
          {buscaMenu ? <button type="button" onClick={() => { setBuscaMenu(''); buscaRef.current?.focus(); }} aria-label="Limpar busca" className="absolute right-7 top-1/2 -translate-y-[calc(50%+6px)] text-white/60 hover:text-white"><X size={15} /></button>
            : <kbd className="pointer-events-none absolute right-7 top-1/2 hidden -translate-y-[calc(50%+6px)] rounded-md border border-white/20 px-1.5 text-[0.7rem] text-white/55 lg:block">/</kbd>}
        </div>
        <nav aria-label="Menu" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4">
          {itensMenu.length === 0 && <p className="px-4 py-3 text-[0.85rem] text-white/55">Nenhum item encontrado.</p>}
          {itensMenu.map(([k, l, Icon]) => {
            const ativo = k !== 'config' && aba === k;
            return (
              <button key={k} type="button" onClick={() => irPara(k)} aria-current={ativo ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[0.92rem] font-medium transition ${ativo ? 'text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,.8)]' : 'text-white/80 hover:bg-white/5'}`}
                style={ativo ? { background: 'linear-gradient(180deg,#c9a24a,#a67c26)' } : undefined}>
                <Icon size={20} strokeWidth={1.7} />{l}
                {k === 'historico' && meus.length > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-white/15 px-1.5 text-[0.68rem] font-bold">{meus.length}</span>}
              </button>
            );
          })}
        </nav>
        <div data-menu-rodape className="relative shrink-0 border-t border-white/10 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {menuRodape && (
            <div role="menu" className="pop absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-xl bg-white py-1.5 text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)]">
              <button type="button" role="menuitem" onClick={() => { setMenuRodape(false); setMenuMovel(false); abrirConfig(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[0.9rem] font-medium transition hover:bg-ivory"><Settings size={18} className="text-gold-600" />Configurações</button>
              <button type="button" role="menuitem" onClick={sair} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[0.9rem] font-medium transition hover:bg-ivory"><LogOut size={18} className="text-gold-600" />Sair</button>
            </div>
          )}
          <button type="button" onClick={() => setMenuRodape((v) => !v)} aria-haspopup="menu" aria-expanded={menuRodape} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5">
            {me.foto_url ? <Avatar foto={me.foto_url} size={40} semBorda /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold" style={{ background: 'linear-gradient(180deg,#d9b655,#a67c26)' }}>{primeiro.charAt(0)}</span>}
            <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[0.85rem] font-semibold">{nomeLimpo(me.nome)}</span><span className="block truncate text-[0.68rem] text-white/60">{me.email}</span></span>
            <ChevronsUpDown size={16} className="shrink-0 text-white/60" aria-hidden />
          </button>
        </div>
      </aside>

      <nav aria-label="Principal" className="order-4 shrink-0 lg:hidden border-t border-line bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:order-2 lg:mx-auto lg:mt-4 lg:w-fit lg:rounded-2xl lg:border lg:p-1.5 lg:shadow-card">
        <div className="relative grid grid-cols-2 lg:grid-cols-[repeat(2,170px)]">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1/2 rounded-xl shadow-[0_8px_18px_-10px_rgba(150,100,10,.7)] transition-transform duration-300 ease-[cubic-bezier(.22,.61,.36,1)]" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)', transform: aba === 'historico' ? 'translateX(100%)' : 'none' }} />
        {([['novo', 'Novo envio', PlusCircle], ['historico', 'Histórico', History]] as const).map(([k, l, Icon]) => {
          const ativo = k === 'novo' ? aba === 'inicio' : aba === k;
          return (
            <button key={k} type="button" aria-current={ativo ? 'page' : undefined}
              onClick={() => { if (k === 'novo') { setAba('inicio'); abrirMenuNovo(); } else setAba(k); }}
              className={`relative z-10 flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors duration-300 text-[0.7rem] font-semibold lg:flex-row lg:justify-center lg:gap-2 lg:py-2 lg:text-[0.82rem] ${ativo ? 'text-white' : 'text-ink/70'}`}
              >
              <span className="relative"><Icon size={20} strokeWidth={1.7} />{k === 'historico' && meus.length > 0 && <span className="absolute -right-3.5 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#b3261e] px-1 text-[0.62rem] font-bold leading-none text-white ring-2 ring-white">{meus.length > 99 ? '99+' : meus.length}</span>}</span>{l}
            </button>
          );
        })}
        </div>
      </nav>

      <main className="order-3 mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col gap-3 px-3 py-3 lg:mx-0 lg:max-w-none lg:gap-5 lg:overflow-y-auto lg:px-8 lg:py-8">
        <div className="hidden shrink-0 lg:block">
          <Titulo nivel={1} icone={GraduationCap}>Olá, {primeiro}</Titulo>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[60px] text-[0.88rem] text-ink/65">
            <span>Área do aluno</span>
            <span className="inline-flex items-center gap-1"><GraduationCap size={14} className="text-gold-600" />{me.matricula ?? 'Sem matrícula'}</span>
            <span className="inline-flex items-center gap-1"><MapPin size={14} className="text-gold-600" />{me.cidade ?? 'Sem cidade'}</span>
          </p>
        </div>
        {painelEnvios}
      </main>
      <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
      {modalDetalhe}
      {menuNovoUI}
      {folhaEnvio}
      {camAberta && <CameraCaptura total={itens.length} max={MAX} onFoto={(f) => adicionar([f])} onFechar={() => setCamAberta(false)} onNativo={() => { setCamAberta(false); camera.current?.click(); }} />}
      {apagar !== null && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Excluir foto" className="pop fixed inset-0 z-[140] grid place-items-center bg-[#120d06]/70 p-5 backdrop-blur-sm" onClick={() => !apagando && setApagar(null)}>
          <div className="w-full max-w-[340px] rounded-2xl bg-white p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.7)]" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#fdf0ee] text-[#b3261e]"><Trash2 size={20} /></span>
            <h3 className="mt-3 text-[1.15rem] font-bold">Excluir esta foto?</h3>
            <p className="mt-1 text-[0.85rem] leading-snug text-ink/65">Ela deixará de aparecer para você. A administração é avisada e pode recuperá-la.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={apagando} onClick={() => setApagar(null)} className="btn btn-line flex-1 !min-h-[44px]">Cancelar</button>
              <button type="button" disabled={apagando} onClick={async () => { setApagando(true); try { await api(`/atendimentos/fotos/${apagar}`, { method: 'DELETE' }); setVer(null); setDet(null); await carregar(); } catch { /* mantém a foto */ } setApagando(false); setApagar(null); }} className="flex-1 rounded-xl bg-[#b3261e] px-4 text-[0.95rem] font-semibold text-white transition hover:brightness-110 disabled:opacity-60" style={{ minHeight: 44 }}>{apagando ? 'Excluindo…' : 'Excluir'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {ver && createPortal(<Ampliada src={fotoUrl(ver.a.fotos[ver.i].id)} baixar={`${fotoUrl(ver.a.fotos[ver.i].id)}?download=1`} excluir={() => setApagar(ver.a.fotos[ver.i].id)} onFechar={() => setVer(null)} nav={{ atual: ver.i, total: ver.a.fotos.length, ir: (n) => setVer({ a: ver.a, i: n }) }} />, document.body)}
    </div>
  );
}

export default function AlunoPage() {
  const { me, sair, recarregar } = useSession('ALUNO');
  const [config, setConfig] = useState(false);
  if (!me) return <PageLoader />;
  if (me.primeiro_acesso) return <PerfilInicial me={me} sair={sair} recarregar={recarregar} />;
  if (config) return <PerfilInicial modo="config" me={me} sair={sair} recarregar={recarregar} onVoltar={() => setConfig(false)} />;
  return <Envio me={me} sair={sair} recarregar={recarregar} abrirConfig={() => setConfig(true)} />;
}

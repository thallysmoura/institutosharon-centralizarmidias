'use client';
import { useEffect, useRef, useState } from 'react';
import { useSecao } from '@/lib/rota';
import { ChevronsUpDown, Search, Menu, X, Settings, GraduationCap, History, LogOut, MapPin, PlusCircle } from 'lucide-react';
import { Me } from '@/lib/api';
import { nomeLimpo, useSession } from '@/lib/session';
import Titulo from '@/components/Titulo';
import { Wordmark } from '@/components/Brand';
import PerfilInicial from '@/components/PerfilInicial';
import Avatar from '@/components/Avatar';
import PageLoader from '@/components/PageLoader';
import MeusEnvios, { MeusEnviosHandle } from '@/components/MeusEnvios';
import Notificacoes from '@/components/Notificacoes';

type Item = { file: File; url: string };
type Aba = 'inicio' | 'historico';
const ABAS: readonly Aba[] = ['inicio', 'historico']; // /aluno e /aluno/historico

const MAX = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

function Envio({ me, sair, recarregar }: { me: Me; sair: () => void; recarregar: () => void }) {
  const [aba, setAbaBase] = useSecao<Aba>('/aluno', ABAS, 'inicio');
  const [config, setConfig] = useState(false);
  const setAba = (k: Aba) => { setConfig(false); setAbaBase(k); };
  const abrirConfig = () => setConfig(true);
  const envios = useRef<MeusEnviosHandle>(null);
  const [total, setTotal] = useState(0); // quantidade de envios, para o selo do Histórico
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
    if (k === 'inicio' && window.matchMedia('(min-width: 1024px)').matches) envios.current?.abrirMenu(); // no celular o menu de envio fica só no rodapé
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
  const primeiro = nomeLimpo(me.nome).split(' ')[0];
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
      {menuMovel && <div className="fixed inset-0 z-40 bg-black/55 lg:hidden" onClick={() => setMenuMovel(false)} aria-hidden />}
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
                {k === 'historico' && total > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-white/15 px-1.5 text-[0.68rem] font-bold">{total}</span>}
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
              onClick={() => { if (k === 'novo') { if (aba === 'inicio' && !config) envios.current?.abrirMenu(); else setAba('inicio'); } else setAba(k); }}
              className={`relative z-10 flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors duration-300 text-[0.7rem] font-semibold lg:flex-row lg:justify-center lg:gap-2 lg:py-2 lg:text-[0.82rem] ${ativo ? 'text-white' : 'text-ink/70'}`}
              >
              <span className="relative"><Icon size={20} strokeWidth={1.7} />{k === 'historico' && total > 0 && <span className="absolute -right-3.5 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#b3261e] px-1 text-[0.62rem] font-bold leading-none text-white ring-2 ring-white">{total > 99 ? '99+' : total}</span>}</span>{l}
            </button>
          );
        })}
        </div>
      </nav>

      <main className="order-3 mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col gap-3 px-3 py-3 lg:mx-0 lg:max-w-none lg:gap-5 lg:overflow-y-auto lg:px-8 lg:py-8">
        {config ? <PerfilInicial modo="config" embutido me={me} sair={sair} recarregar={recarregar} /> : <>
        <div className="hidden shrink-0 lg:block">
          <Titulo nivel={1} icone={GraduationCap}>Olá, {primeiro}</Titulo>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[60px] text-[0.88rem] text-ink/65">
            <span>Área do aluno</span>
            <span className="inline-flex items-center gap-1"><GraduationCap size={14} className="text-gold-600" />{me.matricula ?? 'Sem matrícula'}</span>
            <span className="inline-flex items-center gap-1"><MapPin size={14} className="text-gold-600" />{me.cidade ?? 'Sem cidade'}</span>
          </p>
        </div>
        <MeusEnvios ref={envios} modo={aba === 'inicio' ? 'recentes' : 'historico'} onTotal={setTotal} onVerTodos={() => setAba('historico')} />
        </>}
      </main>
    </div>
  );
}

export default function AlunoPage() {
  const { me, sair, recarregar } = useSession('ALUNO');
  if (!me) return <PageLoader />;
  if (me.primeiro_acesso) return <PerfilInicial me={me} sair={sair} recarregar={recarregar} />;
  return <Envio me={me} sair={sair} recarregar={recarregar} />;
}

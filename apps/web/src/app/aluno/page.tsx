'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Trash2, Settings, Camera, CheckCircle2, GraduationCap, History, ImageIcon, Info, LogOut, MapPin, PlusCircle, User } from 'lucide-react';
import { api, Atendimento, fotoUrl, Me } from '@/lib/api';
import { fmtDia, nomeLimpo, useSession } from '@/lib/session';
import Titulo from '@/components/Titulo';
import PerfilInicial from '@/components/PerfilInicial';
import { createPortal } from 'react-dom';
import Avatar, { Ampliada } from '@/components/Avatar';
import PageLoader from '@/components/PageLoader';

type Item = { file: File; url: string };
type Aba = 'inicio' | 'historico';

const MAX = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

function Envio({ me, sair, recarregar, abrirConfig }: { me: Me; sair: () => void; recarregar: () => void; abrirConfig: () => void }) {
  const [aba, setAba] = useState<Aba>('inicio');
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

  function adicionar(lista: FileList | null) {
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

  const pronto = ident.trim().length >= 2 && itens.length > 0 && !enviando;
  const primeiro = nomeLimpo(me.nome).split(' ')[0];

  const Linha = ({ a }: { a: Atendimento }) => (
    <li className="flex items-center gap-3 border-b border-line/70 py-2.5 last:border-0">
      <div className="flex shrink-0 overflow-hidden rounded-lg bg-sand ring-1 ring-line">
        {a.fotos.slice(0, 2).map((f, i) => (
          <span key={f.id} className="group relative block">
            <button type="button" onClick={() => setVer({ a, i })} aria-label="Ampliar foto" className="block cursor-zoom-in transition hover:brightness-110">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoUrl(f.id, true)} alt="" loading="lazy" className="h-11 w-11 object-cover" />
            </button>
            <button type="button" onClick={() => setApagar(f.id)} aria-label="Excluir foto" title="Excluir foto" className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-90 transition hover:bg-[#b3261e] sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={11} /></button>
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[0.9rem] font-bold">Paciente: {a.identificador_paciente}</p>
        <p className="text-[0.76rem] text-ink/55">{fmtDia(a.created_at)} • {a.fotos.length} foto{a.fotos.length === 1 ? '' : 's'}</p>
      </div>
      <CheckCircle2 size={20} className="shrink-0 fill-[#22a35a] text-white" aria-label="Enviado" />
    </li>
  );

  const painelEnvios = (
    <section key={aba} className={`fade-in flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-white p-4 shadow-card lg:p-5 ${aba === 'historico' ? 'lg:col-span-2' : ''}`}>
      <div className="flex shrink-0 items-center justify-between">
        <Titulo icone={History}>{aba === 'inicio' ? 'Últimos envios' : 'Histórico de envios'}</Titulo>
        {aba === 'inicio' && meus.length > 0 && <button type="button" onClick={() => setAba('historico')} className="text-[0.8rem] font-semibold text-gold-600">Ver todos ({meus.length})</button>}
      </div>
      {meus.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-[0.85rem] text-ink/50">
          <div><span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><ImageIcon size={20} /></span>Nenhum envio ainda.<br />Suas fotos aparecerão aqui.</div>
        </div>
      ) : (
        <ul className="mt-1 min-h-0 flex-1 overflow-y-auto pr-1">{meus.map((a) => <Linha key={a.id} a={a} />)}</ul>
      )}
    </section>
  );

  const painelEnvio = (
    <section className="fade-in flex shrink-0 flex-col rounded-2xl border border-line bg-white p-4 shadow-card lg:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-[1.6rem] font-bold leading-none lg:text-[2rem]">Enviar <span className="italic text-gold-600">fotos</span></h1>
        <span className="text-[0.72rem] font-semibold text-ink/45">{itens.length}/{MAX}</span>
      </div>
      <p className="mt-1 text-[0.8rem] text-ink/60">Registre as fotos do atendimento do paciente.</p>

      <div className="mt-3 grid grid-cols-2 gap-2.5 lg:mt-4 lg:gap-3">
        <button type="button" onClick={() => camera.current?.click()} className="btn btn-gold flex-col !gap-1.5 !rounded-2xl !px-2 !py-3.5 text-center !text-[0.8rem] leading-tight lg:!py-6 lg:!text-[0.9rem]">
          <Camera size={26} strokeWidth={1.6} />Tirar foto
        </button>
        <button type="button" onClick={() => galeria.current?.click()} className="btn flex-col !gap-1.5 !rounded-2xl border border-gold-500/40 bg-[#fbf8f1] !px-2 !py-3.5 text-center !text-[0.8rem] leading-tight shadow-card hover:border-gold-500 lg:!py-6 lg:!text-[0.9rem]">
          <ImageIcon size={26} strokeWidth={1.6} className="text-gold-500" />Selecionar
        </button>
      </div>
      <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />

      <div className="relative mt-3">
        <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
        <input ref={identRef} aria-label="Identificador do paciente" value={ident} onChange={(e) => setIdent(e.target.value)} maxLength={80} placeholder="Paciente (ex.: P-4587)" className="field !mt-0 !py-2.5" />
      </div>

      {itens.length > 0 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {itens.map((i, k) => (
            <li key={i.url} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt={`Pré-visualização ${k + 1}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => remover(k)} aria-label="Remover foto" className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink/75 text-[0.8rem] leading-none text-white">×</button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2.5 rounded-xl px-3 py-2 text-[0.8rem] font-medium ${msg.ok ? 'bg-[#e7f6ee] text-[#17794a]' : 'bg-sand text-ink'}`}>{msg.texto}</p>}

      <button type="button" onClick={enviar} disabled={!pronto} className="btn btn-gold mt-3 w-full !min-h-[48px]">
        {enviando ? 'Enviando…' : itens.length ? `Enviar ${itens.length} foto${itens.length === 1 ? '' : 's'}` : 'Enviar fotos'}
      </button>
      <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-ink/50"><Info size={13} className="shrink-0" />As fotos são organizadas e centralizadas pelo Instituto Sharon.</p>
    </section>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page">
      <header className="relative order-1 shrink-0 overflow-hidden bg-gradient-to-br from-[#1f1a10] via-[#171512] to-[#2a2010] text-white">
        <Image src="/img/emblem.png" alt="" width={958} height={1624} aria-hidden className="pointer-events-none absolute -right-6 top-1/2 h-[190%] w-auto -translate-y-1/2 opacity-[0.07]" />
        <div className="relative mx-auto flex w-full max-w-[1120px] items-center gap-3.5 px-4 py-3 lg:px-8 lg:py-4">
          <Avatar foto={me.foto_url} size={56} editavel onMudou={recarregar} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-gold-300">Área do aluno</p>
            <h2 className="truncate text-[1.7rem] font-bold leading-none text-white">Olá, {primeiro}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[0.72rem] text-white/85">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5"><GraduationCap size={13} className="text-gold-300" />{me.matricula ?? 'Sem matrícula'}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5"><MapPin size={13} className="text-gold-300" />{me.cidade ?? 'Sem cidade'}</span>
            </div>
          </div>
          <button type="button" onClick={abrirConfig} aria-label="Configurações" title="Configurações" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/10"><Settings size={20} /></button>
          <button type="button" onClick={sair} aria-label="Sair" title="Sair" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/10"><LogOut size={20} /></button>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-[#d9b655] via-[#a67c26] to-[#d9b655]" />
      </header>

      <nav aria-label="Principal" className="order-4 shrink-0 border-t border-line bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:order-2 lg:mx-auto lg:mt-4 lg:w-fit lg:rounded-2xl lg:border lg:p-1.5 lg:shadow-card">
        <div className="relative grid grid-cols-2 lg:grid-cols-[repeat(2,170px)]">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1/2 rounded-xl shadow-[0_8px_18px_-10px_rgba(150,100,10,.7)] transition-transform duration-300 ease-[cubic-bezier(.22,.61,.36,1)]" style={{ background: 'linear-gradient(180deg,#c9a24a,#a67c26)', transform: aba === 'historico' ? 'translateX(100%)' : 'none' }} />
        {([['novo', 'Novo envio', PlusCircle], ['historico', 'Histórico', History]] as const).map(([k, l, Icon]) => {
          const ativo = k === 'novo' ? aba === 'inicio' : aba === k;
          return (
            <button key={k} type="button" aria-current={ativo ? 'page' : undefined}
              onClick={() => { if (k === 'novo') { setAba('inicio'); setTimeout(() => identRef.current?.focus(), 50); } else setAba(k); }}
              className={`relative z-10 flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors duration-300 text-[0.7rem] font-semibold lg:flex-row lg:justify-center lg:gap-2 lg:py-2 lg:text-[0.82rem] ${ativo ? 'text-white' : 'text-ink/70'}`}
              >
              <Icon size={20} strokeWidth={1.7} />{l}
            </button>
          );
        })}
        </div>
      </nav>

      <main className="order-3 mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col gap-3 px-4 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-stretch lg:gap-6 lg:px-8 lg:py-5">
        {aba === 'inicio' && painelEnvio}
        {painelEnvios}
      </main>
      {apagar !== null && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Excluir foto" className="pop fixed inset-0 z-[140] grid place-items-center bg-[#120d06]/70 p-5 backdrop-blur-sm" onClick={() => !apagando && setApagar(null)}>
          <div className="w-full max-w-[340px] rounded-2xl bg-white p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.7)]" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#fdf0ee] text-[#b3261e]"><Trash2 size={20} /></span>
            <h3 className="mt-3 text-[1.15rem] font-bold">Excluir esta foto?</h3>
            <p className="mt-1 text-[0.85rem] leading-snug text-ink/65">Ela deixará de aparecer para você. A administração é avisada e pode recuperá-la.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={apagando} onClick={() => setApagar(null)} className="btn btn-line flex-1 !min-h-[44px]">Cancelar</button>
              <button type="button" disabled={apagando} onClick={async () => { setApagando(true); try { await api(`/atendimentos/fotos/${apagar}`, { method: 'DELETE' }); setVer(null); await carregar(); } catch { /* mantém a foto */ } setApagando(false); setApagar(null); }} className="flex-1 rounded-xl bg-[#b3261e] px-4 text-[0.95rem] font-semibold text-white transition hover:brightness-110 disabled:opacity-60" style={{ minHeight: 44 }}>{apagando ? 'Excluindo…' : 'Excluir'}</button>
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

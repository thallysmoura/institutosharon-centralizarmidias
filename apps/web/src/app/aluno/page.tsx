'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Camera, CheckCircle2, GraduationCap, History, House, ImageIcon, Info, LogOut, MapPin, PlusCircle, User } from 'lucide-react';
import { api, Atendimento, fotoUrl, Me } from '@/lib/api';
import { fmtDia, nomeLimpo, useSession } from '@/lib/session';
import Pendente from '@/components/Pendente';

type Item = { file: File; url: string };
type Aba = 'inicio' | 'historico';

const MAX = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

function Envio({ me, sair }: { me: Me; sair: () => void }) {
  const [aba, setAba] = useState<Aba>('inicio');
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
  const lista = aba === 'inicio' ? meus.slice(0, 3) : meus;

  const Linha = ({ a }: { a: Atendimento }) => (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <div className="flex shrink-0 overflow-hidden rounded-lg bg-sand">
        {a.fotos.slice(0, 2).map((f) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f.id} src={fotoUrl(f.id, true)} alt="" loading="lazy" className="h-14 w-14 object-cover" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-bold">Paciente: {a.identificador_paciente}</p>
        <p className="text-[0.8rem] text-ink/60">{fmtDia(a.created_at)} • {a.fotos.length} foto{a.fotos.length === 1 ? '' : 's'}</p>
      </div>
      <CheckCircle2 size={22} className="shrink-0 fill-[#22a35a] text-white" aria-label="Enviado" />
    </li>
  );

  return (
    <div className="min-h-dvh bg-white pb-28 lg:bg-page lg:pb-12">
    <div className="mx-auto flex max-w-[560px] flex-col md:max-w-[720px] lg:max-w-[1120px] lg:px-8">
      <header className="order-1 flex items-center gap-3 px-5 pb-4 pt-6 lg:mt-8 lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:px-7 lg:py-5 lg:shadow-card">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sand text-gold-600"><User size={34} /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.1rem] font-bold">Olá, {nomeLimpo(me.nome)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[0.78rem] text-ink/75"><GraduationCap size={15} className="text-gold-500" />Matrícula: {me.matricula ?? '—'}</p>
          <p className="flex items-center gap-1.5 text-[0.78rem] text-ink/75"><MapPin size={14} className="text-gold-500" />{me.cidade ?? '—'}</p>
        </div>
        <Bell size={22} className="shrink-0 text-ink/80" aria-hidden />
        <button type="button" onClick={sair} aria-label="Sair" title="Sair" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-sand"><LogOut size={20} /></button>
      </header>

      <div className={`order-3 lg:mt-6 lg:grid lg:items-start lg:gap-6 ${aba === 'inicio' ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]' : ''}`}>
      {aba === 'inicio' && (
        <section className="border-t border-line px-5 pt-5 lg:rounded-2xl lg:border lg:bg-white lg:p-7 lg:shadow-card">
          <h1 className="text-[1.5rem] font-bold">Enviar Fotos do Atendimento</h1>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => camera.current?.click()} className="btn btn-gold flex-col !gap-2 !rounded-2xl !px-3 !py-5 text-center !text-[0.9rem] leading-tight">
              <Camera size={30} strokeWidth={1.6} />Tirar Foto<br />(Câmera)
            </button>
            <button type="button" onClick={() => galeria.current?.click()} className="btn flex-col !gap-2 !rounded-2xl border border-line bg-white !px-3 !py-5 text-center !text-[0.9rem] leading-tight shadow-card">
              <ImageIcon size={30} strokeWidth={1.6} className="text-gold-500" />Selecionar<br />do Dispositivo
            </button>
          </div>
          <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />

          <div className="relative mt-4">
            <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/60" aria-hidden />
            <input ref={identRef} aria-label="Identificador do paciente" value={ident} onChange={(e) => setIdent(e.target.value)} maxLength={80} placeholder="Paciente / atendimento (ex.: P-4587)" className="field" />
          </div>

          {itens.length > 0 && (
            <ul className="mt-4 grid grid-cols-4 gap-2">
              {itens.map((i, k) => (
                <li key={i.url} className="relative aspect-square overflow-hidden rounded-xl bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.url} alt={`Pré-visualização ${k + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => remover(k)} aria-label="Remover foto" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white">×</button>
                </li>
              ))}
            </ul>
          )}
          {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? 'bg-[#e7f6ee] text-[#17794a]' : 'bg-sand text-ink'}`}>{msg.texto}</p>}
          {(itens.length > 0 || ident) && (
            <button type="button" onClick={enviar} disabled={!pronto} className="btn btn-gold mt-4 w-full">{enviando ? 'Enviando…' : `Enviar ${itens.length || ''} foto${itens.length === 1 ? '' : 's'}`.replace('  ', ' ')}</button>
          )}

          <div className="mt-4 flex items-start gap-3 rounded-xl bg-[#f6f2ea] p-3.5 text-[0.82rem] text-ink/75">
            <Info size={18} className="mt-0.5 shrink-0 text-ink/70" />
            <p>As fotos serão organizadas e centralizadas pelo Instituto Sharon.</p>
          </div>
        </section>
      )}

      <section className="px-5 pt-6 lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:p-7 lg:shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-[1.5rem] font-bold">{aba === 'inicio' ? 'Últimos Envios' : 'Histórico de Envios'}</h2>
          {aba === 'inicio' && meus.length > 3 && <button type="button" onClick={() => setAba('historico')} className="text-[0.85rem] font-semibold text-gold-600">Ver todos</button>}
        </div>
        {lista.length === 0 ? <p className="mt-3 text-sm text-ink/55">Nenhum envio ainda.</p> : <ul className="mt-2">{lista.map((a) => <Linha key={a.id} a={a} />)}</ul>}
      </section>
      </div>



      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-[560px] grid-cols-3 gap-2 border-t border-line bg-white/95 px-4 pb-4 pt-2 backdrop-blur-md md:max-w-[720px] lg:static lg:order-2 lg:mx-0 lg:mt-5 lg:w-fit lg:max-w-none lg:grid-cols-[repeat(3,140px)] lg:gap-1 lg:rounded-2xl lg:border lg:bg-white lg:p-1.5 lg:shadow-card">
        {([['inicio', 'Início', House], ['novo', 'Novo Envio', PlusCircle], ['historico', 'Histórico', History]] as const).map(([k, l, Icon]) => {
          const ativo = k === 'novo' ? false : aba === k;
          return (
            <button key={k} type="button" aria-current={ativo ? 'page' : undefined}
              onClick={() => { if (k === 'novo') { setAba('inicio'); setTimeout(() => identRef.current?.focus(), 50); } else setAba(k); }}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[0.72rem] font-medium ${ativo ? 'text-white' : 'text-ink/75'}`}
              style={ativo ? { background: 'linear-gradient(180deg,#c9a24a,#a67c26)' } : undefined}>
              <Icon size={22} strokeWidth={1.7} />{l}
            </button>
          );
        })}
      </nav>
    </div>
    </div>
  );
}

export default function AlunoPage() {
  const { me, sair } = useSession('ALUNO');
  if (!me) return <div className="grid min-h-dvh place-items-center text-sm text-ink/50">Carregando…</div>;
  if (!me.autorizado) return <Pendente me={me} sair={sair} />;
  return <Envio me={me} sair={sair} />;
}

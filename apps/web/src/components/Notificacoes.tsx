'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing, X } from 'lucide-react';
import { FotoPerfil } from '@/components/CartaoAluno';
import { API } from '@/lib/api';
import AvisoAnexos from '@/components/AvisoAnexos';
import { haTempo, marcarLida, marcarTodasLidas, pedirPermissaoNotificacoes, pushSuportado, sincronizarPush, useNotificacoes } from '@/lib/notificacoes';

const CHAVE = 'sharon_notif_ate';
const adiado = () => { try { return Number(localStorage.getItem(CHAVE) ?? 0) > Date.now(); } catch { return false; } };
const adiar = (dias: number) => { try { localStorage.setItem(CHAVE, String(Date.now() + dias * 864e5)); } catch { /* sem armazenamento */ } };

/**
 * Sino de notificações. `lugar="menu"` é o do menu lateral (desktop: abre um painel flutuante ao lado da barra);
 * `lugar="topo"` é o do cabeçalho do celular (abre em tela cheia). Só a instância do lugar atual mostra painel e convite.
 */
export default function Notificacoes({ lugar }: { lugar: 'menu' | 'topo' }) {
  const { itens, naoLidas } = useNotificacoes();
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<'todas' | 'nao'>('todas');
  const [aviso, setAviso] = useState<number | null>(null); // aviso aberto em tela própria
  const [pedido, setPedido] = useState<number | null>(null); // id vindo de push/URL, aguardando a lista carregar
  const [celular, setCelular] = useState(false);
  const [convite, setConvite] = useState(false);
  const [permissao, setPermissao] = useState<NotificationPermission | 'indisponivel'>('indisponivel');
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const f = () => setCelular(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);

  const meu = lugar === 'topo' ? celular : !celular; // esta instância é a visível agora

  // Abertura por link (?aviso=ID, vindo do toque numa notificação push com o app fechado).
  useEffect(() => {
    if (!meu) return;
    const id = Number(new URLSearchParams(window.location.search).get('aviso'));
    if (id > 0) {
      setPedido(id);
      const u = new URL(window.location.href);
      u.searchParams.delete('aviso');
      window.history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  }, [meu]);
  // Abre o aviso pedido assim que ele aparece na lista.
  useEffect(() => {
    if (!pedido || !meu) return;
    if (itens.some((n) => n.id === pedido)) { setAviso(pedido); setPedido(null); marcarLida(pedido); }
    else { const t = setTimeout(() => setPedido(null), 15000); return () => clearTimeout(t); }
    return undefined;
  }, [pedido, itens, meu]);

  // Permissão: concedida -> mantém a inscrição em dia; pendente -> convida (uma vez a cada 3 dias).
  useEffect(() => {
    if (!meu) return;
    if (!pushSuportado()) { setPermissao('indisponivel'); return; }
    setPermissao(Notification.permission);
    if (Notification.permission === 'granted') sincronizarPush();
    else if (Notification.permission === 'default' && !adiado()) { const t = setTimeout(() => setConvite(true), 1800); return () => clearTimeout(t); }
    return undefined;
  }, [meu]);

  // Toque numa notificação push com o app aberto: abre o painel.
  useEffect(() => {
    if (!meu) return;
    const f = (e: MessageEvent) => {
      const d = e.data as { tipo?: string; id?: number | null };
      if (d?.tipo === 'abrir-aviso' && d.id) setPedido(d.id);
      else if (d?.tipo === 'abrir-notificacoes' || d?.tipo === 'abrir-aviso') setAberto(true);
    };
    navigator.serviceWorker?.addEventListener('message', f);
    return () => navigator.serviceWorker?.removeEventListener('message', f);
  }, [meu]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    if (celular) document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, [aberto, celular]);

  const lista = aba === 'nao' ? itens.filter((n) => !n.lida) : itens;
  const itemAberto = aviso ? itens.find((n) => n.id === aviso) ?? null : null;

  function abrirItem(id: number) {
    setAviso(id);
    setAberto(false);
    marcarLida(id);
  }
  async function ativar() {
    const r = await pedirPermissaoNotificacoes();
    setPermissao(r);
    setConvite(false);
    if (r !== 'granted') adiar(3);
  }

  const painel = (
    <div className={celular ? 'flex h-full flex-col bg-white' : 'flex max-h-[calc(100dvh-2rem)] w-[400px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_-20px_rgba(33,24,13,.55)]'}>
      <div className="flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
        <h2 className="text-[1.3rem] font-bold">Notificações</h2>
        <button type="button" onClick={() => setAberto(false)} aria-label="Fechar notificações" className="grid h-9 w-9 place-items-center rounded-full text-ink/60 hover:bg-sand"><X size={20} /></button>
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pb-2">
        <div role="tablist" className="flex gap-1.5">
          {([['todas', 'Todas'], ['nao', `Não lidas${naoLidas ? ` (${naoLidas})` : ''}`]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
              className={`rounded-full px-3.5 py-1.5 text-[0.82rem] font-semibold transition ${aba === k ? 'bg-[#f6efe0] text-gold-700' : 'text-ink/60 hover:bg-sand'}`}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={marcarTodasLidas} disabled={!naoLidas} className="text-[0.78rem] font-semibold text-gold-600 disabled:text-ink/30">Marcar todas como lidas</button>
      </div>

      {permissao === 'default' && (
        <button type="button" onClick={ativar} className="mx-5 mb-2 flex items-center gap-2.5 rounded-xl bg-[#fbf5e6] px-3.5 py-2.5 text-left text-[0.8rem] font-medium text-[#6b5a3c]"><BellRing size={18} className="shrink-0 text-gold-600" />Ative as notificações para receber avisos mesmo com o app fechado.</button>
      )}
      {permissao === 'denied' && <p className="mx-5 mb-2 rounded-xl bg-sand px-3.5 py-2.5 text-[0.78rem] text-ink/60">As notificações do navegador estão bloqueadas. Libere nas configurações do site para receber avisos com o app fechado.</p>}

      <ul className="min-h-0 flex-1 overflow-y-auto border-t border-line">
        {lista.length === 0 && (
          <li className="grid place-items-center px-6 py-14 text-center text-[0.85rem] text-ink/50">
            <span><span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Bell size={20} /></span>{aba === 'nao' ? 'Nenhuma notificação não lida.' : 'Você ainda não recebeu avisos.'}</span>
          </li>
        )}
        {lista.map((n) => {
          return (
            <li key={n.id} className="border-b border-line/70 last:border-0">
              <button type="button" onClick={() => abrirItem(n.id)} className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-ivory ${n.lida ? '' : 'bg-[#fffaf0]'}`}>
                <span className="relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-gold-600">{n.autor_foto ? <img src={`${API}${n.autor_foto}`} alt="" referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" /> : <Bell size={18} strokeWidth={1.7} />}{!n.lida && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#b3261e]" aria-label="Não lida" />}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[0.92rem] leading-snug ${n.lida ? 'font-semibold' : 'font-bold'}`}>{n.titulo}</span>
                  <span className="aviso-html mt-0.5 line-clamp-2 block text-[0.84rem] leading-snug text-ink/70" dangerouslySetInnerHTML={{ __html: n.corpo }} />
                  <span className="mt-1 block text-[0.72rem] text-ink/45">{n.autor ? `${n.autor.split(' ')[0]} · ` : ''}{haTempo(n.created_at)}{n.editado_em ? ' · editado' : ''}</span>
                </span>
              </button>
              {n.anexos?.length > 0 && <p className="px-5 pb-3 pl-[4.5rem] text-[0.72rem] font-medium text-gold-700">{n.anexos.length} anexo(s)</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <button ref={botao} type="button" onClick={() => setAberto((v) => !v)} aria-label={naoLidas ? `Notificações, ${naoLidas} não lida(s)` : 'Notificações'} aria-expanded={aberto}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/90 transition hover:bg-white/15 active:scale-95">
        <Bell size={20} strokeWidth={1.7} className={naoLidas ? 'text-[#e7b23c]' : ''} />
        {naoLidas > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#b3261e] px-1 text-[0.62rem] font-bold leading-none text-white ring-2 ring-[#21180D]">{naoLidas > 99 ? '99+' : naoLidas}</span>}
      </button>

      {meu && aberto && createPortal(
        celular ? (
          <div role="dialog" aria-modal="true" aria-label="Notificações" className="fade-in fixed inset-0 z-[90]">{painel}</div>
        ) : (
          <>
            <div className="fixed inset-0 z-[89]" onClick={() => setAberto(false)} aria-hidden />
            <div role="dialog" aria-label="Notificações" className="pop fixed left-[272px] top-4 z-[90]">{painel}</div>
          </>
        ),
        document.body,
      )}

      {meu && itemAberto && createPortal(
        <div role="dialog" aria-modal="true" aria-label={itemAberto.titulo} className="fixed inset-0 z-[96] flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={() => setAviso(null)}>
          <div className="pop flex max-h-[96dvh] w-full max-w-[600px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
              <p className="inline-flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-wide text-gold-700"><Bell size={15} />Aviso</p>
              <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className="grid h-9 w-9 place-items-center rounded-full text-ink/60 hover:bg-sand"><X size={20} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <h2 className="text-[1.35rem] font-bold leading-snug">{itemAberto.titulo}</h2>
              <div className="mt-2.5 flex items-center gap-2.5">
                <FotoPerfil aluno={{ nome: itemAberto.autor ?? '?', foto: itemAberto.autor_foto }} size={34} />
                <p className="text-[0.8rem] leading-tight text-ink/60"><b className="block text-[0.86rem] text-ink">{itemAberto.autor ?? 'Instituto Sharon'}</b>{haTempo(itemAberto.created_at)}{itemAberto.editado_em ? ' · editado' : ''}</p>
              </div>
              <div className="aviso-html mt-4 text-[0.95rem] leading-relaxed text-ink/85" dangerouslySetInnerHTML={{ __html: itemAberto.corpo }} />
              <AvisoAnexos anexos={itemAberto.anexos ?? []} />
            </div>
            <div className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><button type="button" onClick={() => setAviso(null)} className="btn btn-gold !min-h-[46px] w-full">Entendi</button></div>
          </div>
        </div>,
        document.body,
      )}

      {meu && convite && permissao === 'default' && createPortal(
        <div role="dialog" aria-label="Ativar notificações" className="pop fixed inset-x-3 top-[4.75rem] z-[88] mx-auto max-w-[400px] lg:inset-x-auto lg:right-4 lg:top-4 lg:mx-0">
          <div className="rounded-2xl border border-white/10 bg-[#33240F] p-4 text-white shadow-[0_22px_50px_-18px_rgba(33,24,13,.85)]">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7b23c]/20 text-[#e7b23c]"><BellRing size={22} /></span>
              <div className="min-w-0 leading-snug">
                <p className="text-[0.95rem] font-semibold">Ativar notificações?</p>
                <p className="mt-0.5 text-[0.82rem] text-white/70">Receba os avisos do Instituto Sharon assim que forem publicados, mesmo com o app fechado.</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={ativar} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl text-[0.9rem] font-semibold text-[#21180D] active:scale-[0.98]" style={{ background: 'linear-gradient(180deg,#e7b23c,#c9a24a)' }}>Ativar</button>
              <button type="button" onClick={() => { adiar(3); setConvite(false); }} className="min-h-[44px] rounded-xl px-4 text-[0.85rem] font-medium text-white/70 hover:bg-white/10">Agora não</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

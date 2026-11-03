'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing, X } from 'lucide-react';
import { API } from '@/lib/api';
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
  const [expandida, setExpandida] = useState<number | null>(null);
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
    const f = (e: MessageEvent) => { if ((e.data as { tipo?: string })?.tipo === 'abrir-notificacoes') setAberto(true); };
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

  function abrirItem(id: number) {
    setExpandida((v) => (v === id ? null : id));
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
          const aberta = expandida === n.id;
          return (
            <li key={n.id} className="border-b border-line/70 last:border-0">
              <button type="button" onClick={() => abrirItem(n.id)} aria-expanded={aberta} className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-ivory ${n.lida ? '' : 'bg-[#fffaf0]'}`}>
                <span className="relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-gold-600">{n.autor_foto ? <img src={`${API}${n.autor_foto}`} alt="" referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" /> : <Bell size={18} strokeWidth={1.7} />}{!n.lida && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#b3261e]" aria-label="Não lida" />}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[0.92rem] leading-snug ${n.lida ? 'font-semibold' : 'font-bold'}`}>{n.titulo}</span>
                  <span className={`aviso-html mt-0.5 block text-[0.84rem] leading-snug text-ink/70 ${aberta ? '' : 'line-clamp-2'}`} dangerouslySetInnerHTML={{ __html: n.corpo }} />
                  <span className="mt-1 block text-[0.72rem] text-ink/45">{n.autor ? `${n.autor.split(' ')[0]} · ` : ''}{haTempo(n.created_at)}{n.editado_em ? ' · editado' : ''}</span>
                </span>
              </button>
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

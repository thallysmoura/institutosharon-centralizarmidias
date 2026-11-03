'use client';
import { useEffect, useState } from 'react';
import { api } from './api';

export type Notif = { id: number; titulo: string; corpo: string; created_at: string; editado_em: string | null; autor: string | null; autor_foto: string | null; lida: boolean };
type Estado = { itens: Notif[]; naoLidas: number; pronto: boolean };

// Estado compartilhado: vários sinos na mesma tela usam uma única consulta periódica.
let estado: Estado = { itens: [], naoLidas: 0, pronto: false };
const ouvintes = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
const emitir = () => ouvintes.forEach((f) => f());

export const recarregarNotificacoes = () =>
  api<{ itens: Notif[]; nao_lidas: number }>('/notificacoes')
    .then((r) => { estado = { itens: r.itens, naoLidas: r.nao_lidas, pronto: true }; emitir(); })
    .catch(() => null);

export async function marcarLida(id: number) {
  const antes = estado.itens.find((n) => n.id === id);
  if (!antes || antes.lida) return;
  estado = { ...estado, itens: estado.itens.map((n) => (n.id === id ? { ...n, lida: true } : n)), naoLidas: Math.max(0, estado.naoLidas - 1) };
  emitir();
  await api(`/notificacoes/${id}/lida`, { method: 'POST' }).catch(() => recarregarNotificacoes());
}

export async function marcarTodasLidas() {
  estado = { ...estado, itens: estado.itens.map((n) => ({ ...n, lida: true })), naoLidas: 0 };
  emitir();
  await api('/notificacoes/lidas', { method: 'POST' }).catch(() => recarregarNotificacoes());
}

export function useNotificacoes() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    ouvintes.add(f);
    const visivel = () => { if (document.visibilityState === 'visible') recarregarNotificacoes(); };
    const msg = (e: MessageEvent) => { if ((e.data as { tipo?: string })?.tipo === 'notificacao') recarregarNotificacoes(); };
    if (ouvintes.size === 1) {
      recarregarNotificacoes();
      timer = setInterval(visivel, 45_000);
    } else f();
    document.addEventListener('visibilitychange', visivel);
    navigator.serviceWorker?.addEventListener('message', msg);
    return () => {
      ouvintes.delete(f);
      document.removeEventListener('visibilitychange', visivel);
      navigator.serviceWorker?.removeEventListener('message', msg);
      if (!ouvintes.size && timer) { clearInterval(timer); timer = null; }
    };
  }, []);
  return estado;
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias" ou a data. */
export function haTempo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} dia${s >= 2 * 86400 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ---------- Push (permissão do navegador + inscrição) ----------
export const pushSuportado = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

const urlB64 = (b: string) => {
  const p = '='.repeat((4 - (b.length % 4)) % 4);
  const raw = atob((b + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Garante a inscrição deste aparelho no servidor (exige permissão já concedida). */
export async function sincronizarPush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const { publica } = await api<{ publica: string | null }>('/notificacoes/vapid');
    if (!publica) return false;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(publica) as BufferSource }));
    const j = sub.toJSON();
    if (!j.endpoint || !j.keys) return false;
    await api('/notificacoes/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } }) });
    return true;
  } catch { return false; }
}

/** Abre o aviso nativo de permissão e, se aceito, já inscreve o aparelho. */
export async function pedirPermissaoNotificacoes(): Promise<NotificationPermission> {
  const r = await Notification.requestPermission();
  if (r === 'granted') await sincronizarPush();
  return r;
}

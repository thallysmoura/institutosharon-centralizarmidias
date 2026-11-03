export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type Me = { id: number; nome: string; email: string; role: 'ADMIN' | 'ALUNO'; matricula: string | null; cidade: string | null; foto_url: string | null; primeiro_acesso: boolean };
export type Cidade = { id: number; nome: string; lat: number | null; lng: number | null };
export type Foto = { id: number; created_at: string; oculta?: boolean; bytes?: number; width?: number | null; height?: number | null; dispositivo?: string | null; so?: string | null; navegador?: string | null };
export type Atendimento = {
  id: number;
  identificador_paciente: string;
  created_at: string;
  cidade: string;
  aluno: { id: number; nome: string; matricula: string | null; email?: string; foto?: string | null };
  fotos: Foto[];
};

export const fotoUrl = (id: number, thumb = false) => `${API}/fotos/${id}/arquivo${thumb ? '?variant=thumb' : ''}`;

let csrf = '';
let renovando: Promise<boolean> | null = null;

/** Guarda o token CSRF quando a resposta o traz (login, cadastro, refresh, /auth/me). */
const guardaCsrf = (d: unknown) => {
  const t = (d as { csrf?: unknown } | null)?.csrf;
  if (typeof t === 'string') csrf = t;
};

/** Renova a sessão com o refresh token (cookie httpOnly). Uma renovação por vez, compartilhada entre chamadas paralelas. */
function renovarSessao() {
  renovando ??= fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (r) => {
      if (r.ok) guardaCsrf(await r.json().catch(() => null));
      return r.ok;
    })
    .catch(() => false)
    .finally(() => { renovando = null; });
  return renovando;
}

/** Chamada à API com cookies httpOnly, token CSRF nas escritas e renovação automática da sessão (401 -> refresh -> repete). Lança Error com a mensagem do servidor. */
export async function api<T = unknown>(path: string, init: RequestInit = {}, tentouRenovar = false): Promise<T> {
  const headers = new Headers(init.headers);
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (metodo !== 'GET' && csrf) headers.set('X-CSRF-Token', csrf);
  const res = await fetch(`${API}${path}`, { credentials: 'include', ...init, headers });
  if (res.status === 401 && !tentouRenovar && !path.startsWith('/auth/login') && !path.startsWith('/auth/google') && !path.startsWith('/auth/refresh') && (await renovarSessao())) return api<T>(path, init, true);
  if (res.status === 403 && !tentouRenovar && metodo !== 'GET' && !path.startsWith('/auth/')) {
    // token CSRF ausente/desatualizado (ex.: página recarregada): busca de novo e repete uma vez
    await api('/auth/me', {}, true).catch(() => null);
    if (csrf) return api<T>(path, init, true);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(Array.isArray(data?.message) ? data.message[0] : (data?.message ?? 'Erro inesperado.')) as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  guardaCsrf(data);
  if (path === '/auth/logout') csrf = '';
  return data as T;
}

export const fmtData = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

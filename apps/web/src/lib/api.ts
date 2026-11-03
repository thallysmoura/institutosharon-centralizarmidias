export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type Me = { id: number; nome: string; email: string; role: 'ADMIN' | 'ALUNO'; matricula: string | null; cidade: string | null; autorizado: boolean; foto_url: string | null };
export type Cidade = { id: number; nome: string; lat: number | null; lng: number | null };
export type Foto = { id: number; created_at: string };
export type Atendimento = {
  id: number;
  identificador_paciente: string;
  created_at: string;
  cidade: string;
  aluno: { id: number; nome: string; matricula: string | null };
  fotos: Foto[];
};

export const fotoUrl = (id: number, thumb = false) => `${API}/fotos/${id}/arquivo${thumb ? '?variant=thumb' : ''}`;

/** Chamada à API com o cookie de sessão (httpOnly). Lança Error com a mensagem do servidor. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: 'include', ...init });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(Array.isArray(data?.message) ? data.message[0] : (data?.message ?? 'Erro inesperado.')) as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return data as T;
}

export const fmtData = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

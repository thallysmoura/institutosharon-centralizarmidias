'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, UserRound } from 'lucide-react';
import { api, fmtData } from '@/lib/api';
import Avatar from './Avatar';
import PageLoader from './PageLoader';
import Spinner from './Spinner';

type Usuario = {
  id: number; nome: string; email: string; role: 'ALUNO' | 'ADMIN'; matricula: string | null; origem: string;
  ultimo_acesso: string | null; cidade: string | null; foto_url: string | null; fotos: number;
};
type Filtro = 'todos' | 'ALUNO' | 'ADMIN';

function Linha({ u, souEu, mudou }: { u: Usuario; souEu: boolean; mudou: () => void }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const adm = u.role === 'ADMIN';

  async function trocar() {
    setBusy(true);
    setErro('');
    try {
      await api(`/admin/acessos/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: adm ? 'ALUNO' : 'ADMIN' }) });
      mudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar foto={u.foto_url} size={48} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-bold">{u.nome.replace(/ \(.*\)$/, '')} {souEu && <span className="text-[0.72rem] font-semibold text-gold-600">(você)</span>}</p>
          <p className="truncate text-[0.82rem] text-ink/60">{u.email}</p>
          <p className="mt-1 text-[0.75rem] text-ink/50">
            {u.matricula ? `Matrícula ${u.matricula}` : adm ? 'Administração' : 'Matrícula ainda não informada'}{u.cidade ? ` · ${u.cidade}` : ''} · {u.origem === 'google' ? 'Google' : 'Senha'} · último acesso {u.ultimo_acesso ? fmtData(u.ultimo_acesso) : 'nunca'}{!adm ? ` · ${u.fotos} foto(s)` : ''}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-semibold ${adm ? 'bg-[#f6efe0] text-gold-700' : 'bg-[#eef3fa] text-[#35547c]'}`}>
          {adm ? <ShieldCheck size={14} /> : <UserRound size={14} />}{adm ? 'Administrador' : 'Aluno'}
        </span>
        {!souEu && (
          <button type="button" disabled={busy} onClick={trocar} className={`btn !min-h-[38px] !rounded-lg !px-4 !text-[0.8rem] ${adm ? 'btn-line' : 'btn-gold'}`}>
            {busy ? <Spinner size={16} /> : adm ? 'Tornar aluno' : 'Tornar administrador'}
          </button>
        )}
      </div>
      {erro && <p role="alert" className="mt-2 text-[0.8rem] font-medium text-[#b3261e]">{erro}</p>}
    </li>
  );
}

/** Controle de acesso: quem é aluno e quem é administrador. */
export default function ControleAcesso({ meuId }: { meuId: number }) {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(() => api<Usuario[]>('/admin/acessos').then(setLista).finally(() => setLoading(false)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const vis = useMemo(() => lista.filter((u) =>
    (filtro === 'todos' || u.role === filtro) &&
    (!q.trim() || `${u.nome} ${u.email} ${u.matricula ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [lista, filtro, q]);
  const abas: [Filtro, string, number][] = [['todos', 'Todos', lista.length], ['ALUNO', 'Alunos', lista.filter((u) => u.role === 'ALUNO').length], ['ADMIN', 'Administradores', lista.filter((u) => u.role === 'ADMIN').length]];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-line bg-white p-1">
          {abas.map(([k, l, c]) => (
            <button key={k} type="button" onClick={() => setFiltro(k)} aria-pressed={filtro === k}
              className={`rounded-lg px-4 py-2 text-[0.82rem] font-semibold transition ${filtro === k ? 'text-white' : 'text-ink/70 hover:bg-sand'}`}
              style={filtro === k ? { background: 'linear-gradient(180deg,#c9a24a,#a67c26)' } : undefined}>
              {l} <span className={filtro === k ? 'text-white/80' : 'text-ink/40'}>{c}</span>
            </button>
          ))}
        </div>
        <label className="relative min-w-[200px] flex-1 sm:max-w-[320px]">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, e-mail ou matrícula" aria-label="Buscar" className="field-plain !pl-9" />
        </label>
      </div>
      {loading && <PageLoader inline />}
      {!loading && vis.length === 0 && <p className="mt-8 text-center text-ink/55">Nenhum usuário encontrado.</p>}
      <ul className="mt-4 space-y-3">{vis.map((u) => <Linha key={`${u.id}-${u.role}`} u={u} souEu={u.id === meuId} mudou={carregar} />)}</ul>
    </div>
  );
}

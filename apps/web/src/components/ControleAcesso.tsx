'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleCheck, Clock, Search, ShieldCheck, ShieldOff, User } from 'lucide-react';
import { api, fmtData } from '@/lib/api';
import Spinner from './Spinner';

type Acesso = {
  id: number; nome: string; email: string; matricula: string | null; autorizado: boolean; origem: string; foto_url: string | null;
  created_at: string; ultimo_acesso: string | null; cidade_id: number | null; cidade: string | null; fotos: number;
};
type Cidade = { id: number; nome: string };
type Filtro = 'todos' | 'pendentes' | 'autorizados';

function Linha({ a, cidades, salvo }: { a: Acesso; cidades: Cidade[]; salvo: () => void }) {
  const [mat, setMat] = useState(a.matricula ?? '');
  const [cid, setCid] = useState(a.cidade_id ? String(a.cidade_id) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const sujo = mat.trim() !== (a.matricula ?? '') || cid !== (a.cidade_id ? String(a.cidade_id) : '');

  async function enviar(extra: { autorizado?: boolean } = {}) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/admin/acessos/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula: mat.trim(), ...(cid ? { cidade_id: Number(cid) } : {}), ...extra }),
      });
      setMsg({ ok: true, t: extra.autorizado === undefined ? 'Dados salvos.' : extra.autorizado ? 'Acesso liberado.' : 'Acesso revogado.' });
      salvo();
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        {a.foto_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={a.foto_url} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover" />
          : <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><User size={22} /></span>}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-bold">{a.nome}</p>
          <p className="truncate text-[0.82rem] text-ink/60">{a.email}</p>
          <p className="mt-1 text-[0.75rem] text-ink/50">
            {a.origem === 'google' ? 'Entrou com Google' : 'Cadastro por senha'} · último acesso {a.ultimo_acesso ? fmtData(a.ultimo_acesso) : '—'} · {a.fotos} foto(s)
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-semibold ${a.autorizado ? 'bg-[#e7f6ee] text-[#17794a]' : 'bg-[#fdf1da] text-[#9a6a0a]'}`}>
          {a.autorizado ? <CircleCheck size={14} /> : <Clock size={14} />}{a.autorizado ? 'Autorizado' : 'Aguardando'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-[0.78rem] font-semibold text-ink/70">Matrícula
          <input value={mat} onChange={(e) => setMat(e.target.value)} maxLength={30} placeholder="Ex.: IS-0258" className="field-plain mt-1" />
        </label>
        <label className="text-[0.78rem] font-semibold text-ink/70">Cidade de cadastro
          <select value={cid} onChange={(e) => setCid(e.target.value)} className="field-plain mt-1">
            <option value="">Não definida</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" disabled={busy || !sujo} onClick={() => enviar()} className="btn btn-line !min-h-[40px] !rounded-lg !px-4 !text-[0.82rem]">{busy ? <Spinner size={16} /> : 'Salvar'}</button>
          {a.autorizado ? (
            <button type="button" disabled={busy} onClick={() => enviar({ autorizado: false })} className="btn btn-line !min-h-[40px] !gap-1.5 !rounded-lg !px-4 !text-[0.82rem]"><ShieldOff size={16} />Revogar</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => enviar({ autorizado: true })} className="btn btn-gold !min-h-[40px] !gap-1.5 !rounded-lg !px-4 !text-[0.82rem]"><ShieldCheck size={16} />Autorizar</button>
          )}
        </div>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-[0.82rem] font-medium ${msg.ok ? 'text-[#17794a]' : 'text-[#b3261e]'}`}>{msg.t}</p>}
    </li>
  );
}

/** Controle de acesso: lista de quem entrou; o administrador preenche a matrícula e libera o envio de mídias. */
export default function ControleAcesso({ onMudou }: { onMudou: () => void }) {
  const [lista, setLista] = useState<Acesso[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(() => api<Acesso[]>('/admin/acessos').then(setLista).finally(() => setLoading(false)), []);
  useEffect(() => { carregar(); api<Cidade[]>('/admin/cidades').then(setCidades).catch(() => null); }, [carregar]);

  const pend = lista.filter((a) => !a.autorizado).length;
  const vis = useMemo(() => lista.filter((a) =>
    (filtro === 'todos' || (filtro === 'pendentes' ? !a.autorizado : a.autorizado)) &&
    (!q.trim() || `${a.nome} ${a.email} ${a.matricula ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [lista, filtro, q]);

  const abas: [Filtro, string, number][] = [['todos', 'Todos', lista.length], ['pendentes', 'Aguardando', pend], ['autorizados', 'Autorizados', lista.length - pend]];

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

      {loading && <p className="mt-6 text-sm text-ink/55">Carregando…</p>}
      {!loading && vis.length === 0 && <p className="mt-8 text-center text-ink/55">Nenhum acesso encontrado.</p>}
      <ul className="mt-4 space-y-3">
        {vis.map((a) => <Linha key={`${a.id}-${a.autorizado}-${a.matricula}`} a={a} cidades={cidades} salvo={() => { carregar(); onMudou(); }} />)}
      </ul>
    </div>
  );
}

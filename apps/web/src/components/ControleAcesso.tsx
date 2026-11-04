'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { mascaraCpf } from '@/lib/cpf';
import { ChevronDown, MapPin, Monitor, Search, ShieldCheck, SlidersHorizontal, Smartphone, Tablet, UserRound, X } from 'lucide-react';
import { api } from '@/lib/api';
import Avatar from './Avatar';
import PageLoader from './PageLoader';
import Spinner from './Spinner';

type Estado = 'online' | 'ausente' | 'offline';
type Usuario = {
  id: number; nome: string; email: string; role: 'ALUNO' | 'ADMIN'; matricula: string | null; cpf?: string | null; origem: string;
  ultimo_acesso: string | null; cidade: string | null; cidade_id: number | null; foto_url: string | null; fotos: number;
};
type Presenca = { id: number; estado: Estado; visto_em: string | null; dispositivo: string; so: string; navegador: string; ip: string };

const ESTADOS: Record<Estado, { rotulo: string; cor: string; fundo: string; ponto: string }> = {
  online: { rotulo: 'Online', cor: 'text-[#17794a]', fundo: 'bg-[#e7f6ee]', ponto: 'bg-[#22a35a]' },
  ausente: { rotulo: 'Ausente', cor: 'text-[#9a6b12]', fundo: 'bg-[#fbf1d6]', ponto: 'bg-[#e0a526]' },
  offline: { rotulo: 'Offline', cor: 'text-ink/55', fundo: 'bg-sand', ponto: 'bg-ink/30' },
};
const ORDEM: Record<Estado, number> = { online: 0, ausente: 1, offline: 2 };
const ICONE_DISP = { Celular: Smartphone, Tablet, Computador: Monitor } as const;

/** "agora", "há 3 min", "há 2 h", "ontem" ou a data. */
function visto(iso: string | null) {
  if (!iso) return 'Nunca acessou';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'ontem';
  return new Date(iso).toLocaleDateString('pt-BR');
}

type Linha = Usuario & { estado: Estado; p?: Presenca };

function ItemUsuario({ u, souEu, mudou }: { u: Linha; souEu: boolean; mudou: () => void }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const adm = u.role === 'ADMIN';
  const e = ESTADOS[u.estado];
  const Disp = u.p ? ICONE_DISP[u.p.dispositivo as keyof typeof ICONE_DISP] ?? Monitor : null;

  async function trocar() {
    setBusy(true);
    setErro('');
    try {
      await api(`/admin/acessos/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: adm ? 'ALUNO' : 'ADMIN' }) });
      mudou();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card p-4 transition hover:shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <span className="relative shrink-0">
          <Avatar foto={u.foto_url} size={48} />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${e.ponto} ${u.estado === 'online' ? 'animate-pulse' : ''}`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-[200px] leading-tight">
          <p className="truncate font-bold">{u.nome.replace(/ \(.*\)$/, '')} {souEu && <span className="text-[0.72rem] font-semibold text-gold-600">(você)</span>}</p>
          <p className="truncate text-[0.82rem] text-ink/60">{u.email}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-ink/50">
            <span>{u.matricula ? `Matrícula ${u.matricula}` : adm ? 'Administração' : 'Sem matrícula'}</span>
            {u.cpf && <span>CPF {mascaraCpf(u.cpf)}</span>}
            {u.cidade && <span className="inline-flex items-center gap-1"><MapPin size={12} />{u.cidade}</span>}
            <span>{u.origem === 'google' ? 'Google' : 'Senha'}</span>
          </p>
        </div>

        <div className="flex min-w-[150px] flex-col items-start gap-1 sm:items-end">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.74rem] font-semibold ${e.fundo} ${e.cor}`}>
            <span className={`h-2 w-2 rounded-full ${e.ponto}`} />{e.rotulo}
          </span>
          <span className="text-[0.72rem] text-ink/50">{u.estado === 'online' ? 'Ativo agora' : `Visto ${visto(u.p?.visto_em ?? u.ultimo_acesso)}`}</span>
          {u.p && Disp && (
            <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-ink/60" title={`IP ${u.p.ip}`}>
              <Disp size={13} className="text-gold-600" />{u.p.so} · {u.p.navegador}
            </span>
          )}
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

/** Controle de acesso: presença em tempo quase real (online, ausente, offline), filtros e papel de cada usuário. */
export default function ControleAcesso({ meuId }: { meuId: number }) {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [pres, setPres] = useState<Map<number, Presenca>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | Estado>('');
  const [cidade, setCidade] = useState('');
  const [disp, setDisp] = useState('');
  const [perfil, setPerfil] = useState('');
  const [, tick] = useState(0);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const carregar = useCallback(() => api<Usuario[]>('/admin/acessos').then(setLista).catch(() => null).finally(() => setLoading(false)), []);
  useEffect(() => { carregar(); }, [carregar]);

  // Presença: consulta leve (só memória no servidor) a cada 10 s enquanto a aba está visível.
  useEffect(() => {
    const buscar = () => { if (document.visibilityState === 'visible') api<Presenca[]>('/admin/presenca').then((r) => { setPres(new Map(r.map((p) => [p.id, p]))); tick((n) => n + 1); }).catch(() => null); };
    buscar();
    const t = setInterval(buscar, 10_000);
    document.addEventListener('visibilitychange', buscar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', buscar); };
  }, []);

  const todos: Linha[] = useMemo(() => lista.map((u) => { const p = pres.get(u.id); return { ...u, p, estado: p?.estado ?? 'offline' }; }), [lista, pres]);
  const cidades = useMemo(() => [...new Set(lista.map((u) => u.cidade).filter(Boolean) as string[])].sort(), [lista]);
  const conta = (e: Estado) => todos.filter((u) => u.estado === e).length;

  const vis = useMemo(() => {
    const t = q.trim().toLowerCase();
    return todos
      .filter((u) => (!status || u.estado === status) && (!cidade || u.cidade === cidade) && (!perfil || u.role === perfil) && (!disp || u.p?.dispositivo === disp) && (!t || `${u.nome} ${u.email} ${u.matricula ?? ''}`.toLowerCase().includes(t)))
      .sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado] || +new Date(b.p?.visto_em ?? b.ultimo_acesso ?? 0) - +new Date(a.p?.visto_em ?? a.ultimo_acesso ?? 0) || a.nome.localeCompare(b.nome));
  }, [todos, q, status, cidade, perfil, disp]);

  const filtrando = !!(q || status || cidade || disp || perfil);
  const limpar = () => { setQ(''); setStatus(''); setCidade(''); setDisp(''); setPerfil(''); };
  const sel = 'field-plain !w-auto min-w-[150px]';

  return (
    <div className="mt-6">
      <div className="grid grid-cols-3 gap-3">
        {(['online', 'ausente', 'offline'] as Estado[]).map((k) => {
          const e = ESTADOS[k];
          const ativo = status === k;
          return (
            <button key={k} type="button" onClick={() => setStatus(ativo ? '' : k)} aria-pressed={ativo}
              className={`card flex items-center gap-3 p-3 text-left transition hover:shadow-soft sm:p-4 ${ativo ? '!border-gold-500 ring-2 ring-gold-500/20' : ''}`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${e.fundo}`}><span className={`h-3 w-3 rounded-full ${e.ponto} ${k === 'online' && conta(k) ? 'animate-pulse' : ''}`} /></span>
              <span className="leading-tight"><span className="block text-[1.4rem] font-bold">{conta(k)}</span><span className="text-[0.78rem] text-ink/60">{e.rotulo}</span></span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex"><button type="button" onClick={() => setFiltrosAbertos((v) => !v)} aria-expanded={filtrosAbertos} className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-[0.82rem] font-semibold text-ink/80 transition hover:bg-ivory"><SlidersHorizontal size={16} />Filtros{[q, cidade, disp, perfil].filter(Boolean).length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold-600 px-1.5 text-[0.68rem] font-bold text-white">{[q, cidade, disp, perfil].filter(Boolean).length}</span>}<ChevronDown size={15} className={`transition ${filtrosAbertos ? 'rotate-180' : ''}`} /></button></div>
      {filtrosAbertos && <div className="card fade-in mt-3 flex flex-wrap items-center gap-2.5 p-3">
        <label className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, e-mail ou matrícula" aria-label="Buscar" className="field-plain !pl-9" />
        </label>
        <select value={cidade} onChange={(e) => setCidade(e.target.value)} aria-label="Cidade" className={sel}><option value="">Todas as cidades</option>{cidades.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={disp} onChange={(e) => setDisp(e.target.value)} aria-label="Dispositivo" className={sel}><option value="">Todos os dispositivos</option><option>Celular</option><option>Tablet</option><option>Computador</option></select>
        <select value={perfil} onChange={(e) => setPerfil(e.target.value)} aria-label="Perfil" className={sel}><option value="">Todos os perfis</option><option value="ALUNO">Alunos</option><option value="ADMIN">Administradores</option></select>
        {filtrando && <button type="button" onClick={limpar} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[0.8rem] font-semibold text-gold-700 hover:bg-sand"><X size={14} />Limpar</button>}
      </div>}

      <p className="mt-3 flex items-center gap-2 text-[0.78rem] text-ink/55">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#17794a]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#22a35a]" />Atualização automática</span>
        · {vis.length} de {todos.length} usuário{todos.length === 1 ? '' : 's'}
      </p>

      {loading && <PageLoader inline />}
      {!loading && vis.length === 0 && <p className="mt-8 text-center text-ink/55">Nenhum usuário encontrado com esses filtros.</p>}
      <ul className="mt-3 space-y-3">{vis.map((u) => <ItemUsuario key={`${u.id}-${u.role}`} u={u} souEu={u.id === meuId} mudou={carregar} />)}</ul>
    </div>
  );
}

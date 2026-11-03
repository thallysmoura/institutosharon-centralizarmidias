'use client';
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Search, ShieldAlert, SlidersHorizontal, X } from 'lucide-react';
import { api } from '@/lib/api';
import { nomeLimpo } from '@/lib/session';
import Spinner from './Spinner';

type Reg = {
  id: number; quando: string; acao: string; ip: string | null; user_agent: string | null; foto_id: number | null; atendimento_id: number | null;
  detalhe: Record<string, unknown> | null; ator_email: string | null; ator: { id: number; nome: string; email: string; role: 'ALUNO' | 'ADMIN' } | null;
};
type Pagina = { itens: Reg[]; proximo: number | null };

/** Rótulo e tom de cada ação registrada. */
const ACOES: Record<string, { rotulo: string; tom: 'ok' | 'info' | 'alerta' | 'erro' }> = {
  login: { rotulo: 'Entrou no sistema', tom: 'info' },
  login_falha: { rotulo: 'Tentativa de login falhou', tom: 'alerta' },
  logout: { rotulo: 'Saiu do sistema', tom: 'info' },
  cadastro: { rotulo: 'Criou a conta', tom: 'ok' },
  senha_redefinida: { rotulo: 'Redefiniu a senha', tom: 'alerta' },
  perfil_editado: { rotulo: 'Editou o perfil', tom: 'info' },
  foto_perfil_alterada: { rotulo: 'Trocou a foto de perfil', tom: 'info' },
  foto_perfil_removida: { rotulo: 'Removeu a foto de perfil', tom: 'info' },
  email_alterado: { rotulo: 'Alterou o e-mail', tom: 'alerta' },
  envio_fotos: { rotulo: 'Enviou fotos', tom: 'ok' },
  aluno_editou_paciente: { rotulo: 'Editou o nome do paciente', tom: 'info' },
  aluno_ocultou_foto: { rotulo: 'Excluiu uma foto (oculta)', tom: 'erro' },
  admin_restaurou_foto: { rotulo: 'Restaurou uma foto', tom: 'ok' },
  admin_excluiu_foto: { rotulo: 'Excluiu foto definitivamente', tom: 'erro' },
  admin_alterou_papel: { rotulo: 'Alterou o perfil de acesso', tom: 'alerta' },
  admin_exportou_excel: { rotulo: 'Exportou planilha', tom: 'info' },
  admin_criou_aviso: { rotulo: 'Publicou um aviso', tom: 'ok' },
  admin_editou_aviso: { rotulo: 'Editou um aviso', tom: 'info' },
  admin_excluiu_aviso: { rotulo: 'Excluiu um aviso', tom: 'erro' },
};
const TOM = { ok: 'badge-ok', info: 'bg-[#eef3fa] text-[#35547c]', alerta: 'badge-warn', erro: 'badge-erro' } as const;
const CAMPOS: Record<string, string> = {
  paciente: 'Paciente', quantidade: 'Fotos', de: 'De', para: 'Para', metodo: 'Método', lembrar: 'Mantido conectado', motivo: 'Motivo', matricula: 'Matrícula',
  matricula_antes: 'Matrícula anterior', nome: 'Nome', nome_antes: 'Nome anterior', novo_papel: 'Novo perfil', usuario_id: 'Usuário nº', cidade_id: 'Cidade nº', dias: 'Período (dias)', aviso: 'Aviso nº', titulo: 'Título',
};

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Resume o JSON de detalhes em "Campo: valor". */
function detalhes(r: Reg) {
  const d = r.detalhe ?? {};
  const itens: [string, string][] = [];
  for (const [k, v] of Object.entries(d)) {
    if (v == null || v === '' || typeof v === 'object') continue;
    itens.push([CAMPOS[k] ?? k, typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v)]);
  }
  if (r.atendimento_id) itens.push(['Atendimento', `#${r.atendimento_id}`]);
  if (r.foto_id) itens.push(['Foto', `#${r.foto_id}`]);
  return itens;
}

function aparelho(ua: string | null) {
  if (!ua) return '';
  const so = /iPhone|iPad/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const nav = /Edg\//i.test(ua) ? 'Edge' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : '';
  return [so, nav].filter(Boolean).join(' · ');
}

/** Auditoria: trilha de tudo que os usuários fazem no sistema, com filtros e carregamento por páginas. */
export default function Auditoria() {
  const [itens, setItens] = useState<Reg[]>([]);
  const [proximo, setProximo] = useState<number | null>(null);
  const [acoes, setAcoes] = useState<{ acao: string; n: number }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [maisBusy, setMaisBusy] = useState(false);
  const [abertos, setAbertos] = useState(false);
  const [q, setQ] = useState('');
  const [acao, setAcao] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const qs = useCallback((antes?: number) => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (acao) p.set('acao', acao);
    if (de) p.set('de', de);
    if (ate) p.set('ate', ate);
    if (antes) p.set('antes', String(antes));
    return p.toString();
  }, [q, acao, de, ate]);

  useEffect(() => { api<{ acao: string; n: number }[]>('/admin/auditoria/acoes').then(setAcoes).catch(() => null); }, []);
  useEffect(() => {
    setCarregando(true);
    const t = setTimeout(() => {
      api<Pagina>(`/admin/auditoria?${qs()}`).then((r) => { setItens(r.itens); setProximo(r.proximo); }).catch(() => null).finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [qs]);

  async function maisRegistros() {
    if (!proximo) return;
    setMaisBusy(true);
    try { const r = await api<Pagina>(`/admin/auditoria?${qs(proximo)}`); setItens((l) => [...l, ...r.itens]); setProximo(r.proximo); } finally { setMaisBusy(false); }
  }

  const filtros = [q, acao, de, ate].filter(Boolean).length;
  const limpar = () => { setQ(''); setAcao(''); setDe(''); setAte(''); };

  return (
    <div className="mt-5 sm:mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-[0.82rem] text-ink/60"><ShieldAlert size={16} className="text-gold-600" />Registro de todas as ações dos usuários, para governança e acompanhamento.</p>
        <button type="button" onClick={() => setAbertos((v) => !v)} aria-expanded={abertos} className="ml-auto inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-[0.82rem] font-semibold text-ink/80 transition hover:bg-ivory">
          <SlidersHorizontal size={16} />Filtros{filtros > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold-600 px-1.5 text-[0.68rem] font-bold text-white">{filtros}</span>}<ChevronDown size={15} className={`transition ${abertos ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {abertos && (
        <div className="card fade-in mt-3 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative text-[0.78rem] font-semibold text-ink/70 sm:col-span-2 xl:col-span-1">Buscar
            <Search size={16} className="pointer-events-none absolute left-3 top-[2.45rem] text-ink/50" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, e-mail, IP ou detalhe" className="field-plain mt-1 !pl-9" />
          </label>
          <label className="text-[0.78rem] font-semibold text-ink/70">Ação
            <select value={acao} onChange={(e) => setAcao(e.target.value)} className="field-plain mt-1"><option value="">Todas</option>{acoes.map((a) => <option key={a.acao} value={a.acao}>{ACOES[a.acao]?.rotulo ?? a.acao} ({a.n})</option>)}</select>
          </label>
          <div className="text-[0.78rem] font-semibold text-ink/70 sm:col-span-2">Período
            <div className="mt-1 flex items-center gap-1.5">
              <input type="date" aria-label="De" value={de} onChange={(e) => setDe(e.target.value)} className="field-plain min-w-0 flex-1 !px-2" />
              <input type="date" aria-label="Até" value={ate} onChange={(e) => setAte(e.target.value)} className="field-plain min-w-0 flex-1 !px-2" />
              {filtros > 0 && <button type="button" onClick={limpar} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-[0.78rem] font-semibold text-gold-700 hover:bg-sand"><X size={14} />Limpar</button>}
            </div>
          </div>
        </div>
      )}

      <div className="card mt-4 overflow-hidden !p-0">
        <div className="hidden grid-cols-[150px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] gap-4 border-b border-line bg-[#f3efe7] px-4 py-3 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-ink/70 lg:grid">
          <span>Data e horário</span><span>Usuário</span><span>Ação</span><span>Detalhes</span><span>Origem</span>
        </div>
        {carregando && itens.length === 0 && <div className="space-y-3 p-4" aria-hidden>{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}</div>}
        {!carregando && itens.length === 0 && <p className="px-4 py-12 text-center text-ink/55">Nenhum registro encontrado.</p>}
        <ul className={carregando ? 'opacity-60 transition' : 'transition'}>
          {itens.map((r) => {
            const a = ACOES[r.acao] ?? { rotulo: r.acao, tom: 'info' as const };
            const det = detalhes(r);
            const nome = r.ator ? nomeLimpo(r.ator.nome) : r.ator_email ?? 'Desconhecido';
            return (
              <li key={r.id} className="grid gap-x-4 gap-y-1.5 border-b border-line px-4 py-3 last:border-b-0 lg:grid-cols-[150px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] lg:items-start">
                <span className="text-[0.78rem] tabular-nums text-ink/60">{fmt(r.quando)}</span>
                <span className="min-w-0 leading-tight">
                  <b className="block truncate text-[0.88rem]">{nome}</b>
                  <span className="block truncate text-[0.72rem] text-ink/55">{r.ator?.email ?? r.ator_email ?? ''}{r.ator?.role === 'ADMIN' ? ' · administrador' : ''}</span>
                </span>
                <span><span className={`badge ${TOM[a.tom]}`}>{a.rotulo}</span></span>
                <span className="min-w-0 text-[0.78rem] leading-snug text-ink/70">{det.length ? det.map(([k, v]) => <span key={k} className="mr-3 inline-block"><span className="text-ink/45">{k}:</span> <b className="font-semibold text-ink/80">{v}</b></span>) : <span className="text-ink/35">-</span>}</span>
                <span className="text-[0.72rem] leading-tight text-ink/55">{r.ip ?? '-'}<br />{aparelho(r.user_agent)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {proximo && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={maisRegistros} disabled={maisBusy} className="btn btn-line !min-h-[44px] !gap-2 !px-6">{maisBusy ? <Spinner size={16} /> : null}Carregar mais registros</button>
        </div>
      )}
    </div>
  );
}

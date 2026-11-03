'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, Pencil, Plus, Search, Send, Trash2, UserRound, Users, X } from 'lucide-react';
import { API, api } from '@/lib/api';
import { fmtData } from '@/lib/api';
import { nomeLimpo } from '@/lib/session';
import EditorTexto from './EditorTexto';
import Spinner from './Spinner';

type Dest = { id: number; nome: string; email: string };
type Aviso = { id: number; titulo: string; corpo: string; para_todos: boolean; created_at: string; editado_em: string | null; autor: string | null; autor_foto: string | null; lidos: number; total: number; destinatarios: Dest[] };
type Usuario = Dest & { role: 'ALUNO' | 'ADMIN'; matricula: string | null };

const vazioHtml = (h: string) => !h.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

/** Formulário de aviso (novo ou edição): título, destinatários (todos ou pessoas) e texto formatado. */
function FormAviso({ inicial, onFechar, onSalvo }: { inicial: Aviso | null; onFechar: () => void; onSalvo: () => void }) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [corpo, setCorpo] = useState(inicial?.corpo ?? '');
  const [todos, setTodos] = useState(inicial?.para_todos ?? true);
  const [dest, setDest] = useState<Dest[]>(inicial?.destinatarios ?? []);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<Usuario[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const t = busca.trim();
    if (t.length < 3) { setAchados([]); return; }
    setBuscando(true);
    const h = setTimeout(() => {
      api<Usuario[]>(`/admin/usuarios/busca?q=${encodeURIComponent(t)}`).then((r) => setAchados(r.filter((u) => !dest.some((d) => d.id === u.id)))).catch(() => setAchados([])).finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(h);
  }, [busca, dest]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onFechar(); };
    document.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, [onFechar, busy]);

  const pronto = titulo.trim().length >= 2 && !vazioHtml(corpo) && (todos || dest.length > 0);

  async function salvar() {
    setBusy(true);
    setErro('');
    try {
      const corpoReq = { titulo: titulo.trim(), corpo, todos, destinatarios: todos ? [] : dest.map((d) => d.id) };
      await api(inicial ? `/admin/avisos/${inicial.id}` : '/admin/avisos', { method: inicial ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpoReq) });
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
      setBusy(false);
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={inicial ? 'Editar aviso' : 'Novo aviso'} className="fade-in fixed inset-0 z-[100] flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={() => !busy && onFechar()}>
      <div className="pop flex max-h-[96dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[1.25rem] font-bold">{inicial ? 'Editar aviso' : 'Novo aviso'}</h2>
          <button type="button" onClick={onFechar} disabled={busy} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full text-ink/60 hover:bg-sand"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-[0.78rem] font-semibold text-ink/70">Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Ex.: Reunião geral na sexta" className="field mt-1 !pl-4" />
          </label>

          <div>
            <p className="text-[0.78rem] font-semibold text-ink/70">Enviar para</p>
            <div role="radiogroup" className="mt-1 grid grid-cols-2 gap-2">
              {([[true, 'Todos', Users, 'Todos os usuários'], [false, 'Pessoas específicas', UserRound, 'Escolher quem recebe']] as const).map(([v, r, Icone, sub]) => (
                <button key={r} type="button" role="radio" aria-checked={todos === v} onClick={() => setTodos(v)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${todos === v ? 'border-gold-500 bg-[#fbf5e6] ring-2 ring-gold-500/20' : 'border-line bg-white hover:bg-ivory'}`}>
                  <Icone size={18} className="shrink-0 text-gold-600" /><span className="leading-tight"><b className="block text-[0.88rem]">{r}</b><span className="text-[0.72rem] text-ink/55">{sub}</span></span>
                </button>
              ))}
            </div>

            {!todos && (
              <div className="mt-3">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa (3+ letras: nome, e-mail ou matrícula)" aria-label="Buscar pessoa" className="field-plain !pl-9" />
                  {busca.trim().length >= 3 && (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-soft">
                      {buscando && <li className="px-3 py-2.5 text-[0.82rem] text-ink/55">Buscando…</li>}
                      {!buscando && achados.length === 0 && <li className="px-3 py-2.5 text-[0.82rem] text-ink/55">Ninguém encontrado.</li>}
                      {achados.map((u) => (
                        <li key={u.id}><button type="button" onClick={() => { setDest((d) => [...d, { id: u.id, nome: u.nome, email: u.email }]); setBusca(''); }} className="block w-full px-3 py-2 text-left hover:bg-ivory">
                          <span className="text-[0.88rem] font-semibold">{nomeLimpo(u.nome)}</span><span className="block text-[0.72rem] text-ink/55">{u.email}{u.role === 'ADMIN' ? ' · administrador' : ''}</span>
                        </button></li>
                      ))}
                    </ul>
                  )}
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {dest.map((d) => (
                    <li key={d.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#f6efe0] py-1 pl-3 pr-1.5 text-[0.78rem] font-medium text-[#6b5a3c]">{nomeLimpo(d.nome)}
                      <button type="button" onClick={() => setDest((l) => l.filter((x) => x.id !== d.id))} aria-label={`Remover ${d.nome}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-white"><X size={12} /></button>
                    </li>
                  ))}
                  {dest.length === 0 && <li className="text-[0.78rem] text-ink/50">Nenhuma pessoa escolhida ainda.</li>}
                </ul>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 text-[0.78rem] font-semibold text-ink/70">Mensagem</p>
            <EditorTexto valor={corpo} onChange={setCorpo} />
          </div>
          {erro && <p role="alert" className="rounded-xl bg-[#fdf0ee] px-3 py-2 text-[0.82rem] font-medium text-[#b3261e]">{erro}</p>}
        </div>

        <div className="flex gap-2.5 border-t border-line px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onFechar} disabled={busy} className="btn btn-line !min-h-[46px] !px-5">Cancelar</button>
          <button type="button" onClick={salvar} disabled={!pronto || busy} className="btn btn-gold !min-h-[46px] flex-1 !gap-2">{busy ? <Spinner size={16} /> : <Send size={16} />}{inicial ? 'Salvar alterações' : 'Enviar aviso'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Mural de avisos: histórico, novo aviso (todos ou pessoas específicas), editar e excluir. Cada aviso novo notifica os destinatários. */
export default function MuralAvisos() {
  const [lista, setLista] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<Aviso | 'novo' | null>(null);
  const [apagar, setApagar] = useState<Aviso | null>(null);
  const [apagando, setApagando] = useState(false);
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(() => api<Aviso[]>('/admin/avisos').then(setLista).catch(() => null).finally(() => setCarregando(false)), []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 4000); return () => clearTimeout(t); }, [aviso]);

  async function excluir() {
    if (!apagar) return;
    setApagando(true);
    try { await api(`/admin/avisos/${apagar.id}`, { method: 'DELETE' }); setApagar(null); await carregar(); setAviso('Aviso excluído.'); } finally { setApagando(false); }
  }

  return (
    <div className="mt-5 sm:mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.85rem] text-ink/60">Cada aviso publicado vira notificação para os destinatários, com histórico aqui.</p>
        <button type="button" onClick={() => setForm('novo')} className="btn btn-gold !min-h-[44px] !gap-2 !px-4"><Plus size={18} />Novo aviso</button>
      </div>
      {aviso && <p role="status" className="pop mt-3 rounded-xl bg-[#e7f6ee] px-3 py-2.5 text-[0.82rem] font-medium text-[#17794a]">{aviso}</p>}

      {carregando && <div className="mt-4 space-y-3" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>}
      {!carregando && lista.length === 0 && (
        <div className="card mt-4 grid place-items-center px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Megaphone size={22} /></span>
          <p className="mt-3 font-semibold">Nenhum aviso publicado</p>
          <p className="text-[0.85rem] text-ink/55">Toque em <b>Novo aviso</b> para falar com todos ou com pessoas específicas.</p>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {lista.map((a) => (
          <li key={a.id} className="card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f6efe0] text-[0.9rem] font-bold text-gold-700">
                  {a.autor_foto ? <img src={`${API}${a.autor_foto}`} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : (a.autor ? nomeLimpo(a.autor).charAt(0).toUpperCase() : '?')}
                </span>
                <div className="min-w-0">
                <h3 className="text-[1.02rem] font-bold leading-snug">{a.titulo}</h3>
                <p className="mt-0.5 text-[0.74rem] text-ink/50">{a.autor ? `${nomeLimpo(a.autor)} · ` : ''}{fmtData(a.created_at)}{a.editado_em ? ' · editado' : ''}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" onClick={() => setForm(a)} aria-label="Editar aviso" title="Editar" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink/70 transition hover:bg-ivory"><Pencil size={16} /></button>
                <button type="button" onClick={() => setApagar(a)} aria-label="Excluir aviso" title="Excluir" className="grid h-9 w-9 place-items-center rounded-lg border border-[#b3261e]/40 text-[#b3261e] transition hover:bg-[#fdf0ee]"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="aviso-html mt-2.5 text-[0.88rem] leading-relaxed text-ink/80" dangerouslySetInnerHTML={{ __html: a.corpo }} />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.74rem]">
              <span className="badge bg-[#f6efe0] text-[#6b5a3c]">{a.para_todos ? <Users size={13} /> : <UserRound size={13} />}{a.para_todos ? 'Todos' : a.destinatarios.map((d) => nomeLimpo(d.nome).split(' ')[0]).slice(0, 3).join(', ') + (a.destinatarios.length > 3 ? ` +${a.destinatarios.length - 3}` : '')}</span>
              <span className="badge badge-neutro">{a.lidos} de {a.total} leram</span>
            </div>
          </li>
        ))}
      </ul>

      {form && <FormAviso key={form === 'novo' ? 'novo' : form.id} inicial={form === 'novo' ? null : form} onFechar={() => setForm(null)} onSalvo={async () => { const edit = form !== 'novo'; setForm(null); await carregar(); setAviso(edit ? 'Aviso atualizado.' : 'Aviso enviado. Os destinatários foram notificados.'); }} />}

      {apagar && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Excluir aviso" className="fade-in fixed inset-0 z-[110] grid place-items-center bg-ink/60 p-4" onClick={() => !apagando && setApagar(null)}>
          <div className="pop w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#fdf0ee] text-[#b3261e]"><Trash2 size={20} /></span>
            <h3 className="mt-3 text-[1.15rem] font-bold">Excluir este aviso?</h3>
            <p className="mt-1 text-[0.88rem] text-ink/65">&quot;{apagar.titulo}&quot; deixa de aparecer nas notificações dos destinatários. Essa ação fica registrada na auditoria.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={apagando} onClick={() => setApagar(null)} className="btn btn-line !min-h-[40px] !rounded-lg !px-4 !text-[0.85rem]">Cancelar</button>
              <button type="button" disabled={apagando} onClick={excluir} className="inline-flex min-h-[40px] items-center rounded-lg bg-[#b3261e] px-4 text-[0.85rem] font-semibold text-white disabled:opacity-60">{apagando ? 'Excluindo…' : 'Sim, excluir'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

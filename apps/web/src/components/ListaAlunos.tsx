'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import IconeCpf from '@/components/IconeCpf';
import { CalendarDays, ChevronLeft, ChevronRight, IdCard, Images, Mail, MapPin, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDia, nomeLimpo } from '@/lib/session';
import { mascaraCpf } from '@/lib/cpf';
import { FotoPerfil } from '@/components/CartaoAluno';
import FotosAluno from '@/components/FotosAluno';

type Linha = { id: number; nome: string; email: string; matricula: string | null; cpf: string | null; cidade: string | null; foto: string | null; created_at: string; atendimentos: number; fotos: number };
type Resposta = { itens: Linha[]; total: number; porPagina: number };
type Cid = { id: number; nome: string };

/**
 * Alunos: busca, filtro por cidade e ordenação no servidor, com paginação (30 por página).
 * Só a página aberta trafega, então continua leve com muitos alunos; mantém a página anterior na tela enquanto carrega a próxima.
 */
export default function ListaAlunos({ cidades }: { cidades: Cid[] }) {
  const [ver, setVer] = useState<Linha | null>(null); // aluno cujas fotos estão abertas na janela
  const [q, setQ] = useState('');
  const [cidade, setCidade] = useState('');
  const [ordem, setOrdem] = useState<'nome' | 'recentes' | 'antigos'>('nome');
  const [pagina, setPagina] = useState(0);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const topo = useRef<HTMLDivElement>(null);
  const pedido = useRef(0);

  const buscar = useCallback((termo: string, cid: string, ord: string, pg: number) => {
    const n = ++pedido.current;
    setCarregando(true);
    api<Resposta>(`/admin/alunos?q=${encodeURIComponent(termo.trim())}&cidade=${cid}&ordem=${ord}&pagina=${pg}`)
      .then((r) => { if (n === pedido.current) { setDados(r); setErro(''); } })
      .catch((e) => { if (n === pedido.current) setErro((e as Error).message); })
      .finally(() => { if (n === pedido.current) setCarregando(false); });
  }, []);

  // A busca por texto espera 300 ms depois da última tecla; os demais filtros e a página consultam na hora.
  useEffect(() => {
    const t = setTimeout(() => buscar(q, cidade, ordem, pagina), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, cidade, ordem, pagina, buscar]);

  const filtrar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(0); };
  const irPagina = (p: number) => { setPagina(p); topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const total = dados?.total ?? 0;
  const por = dados?.porPagina ?? 30;
  const paginas = Math.max(1, Math.ceil(total / por));
  const de = total ? pagina * por + 1 : 0;
  const ate = Math.min(total, (pagina + 1) * por);
  const filtrado = !!q.trim() || !!cidade;

  return (
    <section className="mt-6" aria-label="Alunos">
      <div ref={topo} className="scroll-mt-4" />
      <div className="card grid gap-2.5 p-3.5 sm:grid-cols-[1fr_200px_170px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
          <input value={q} onChange={(e) => filtrar(setQ)(e.target.value)} placeholder="Buscar por nome, e-mail, matrícula ou CPF" aria-label="Buscar aluno" className="field-plain !pl-9 !pr-9" />
          {q && <button type="button" onClick={() => filtrar(setQ)('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink/50 hover:bg-sand"><X size={15} /></button>}
        </div>
        <select value={cidade} onChange={(e) => filtrar(setCidade)(e.target.value)} aria-label="Cidade" className="field-plain">
          <option value="">Todas as cidades</option>
          {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={ordem} onChange={(e) => filtrar(setOrdem)(e.target.value as typeof ordem)} aria-label="Ordenar" className="field-plain">
          <option value="nome">Nome (A-Z)</option>
          <option value="recentes">Cadastro mais recente</option>
          <option value="antigos">Cadastro mais antigo</option>
        </select>
      </div>

      <p className="mt-3 text-[0.8rem] text-ink/55" aria-live="polite">{dados ? (total ? `${de}-${ate} de ${total.toLocaleString('pt-BR')} aluno(s)${filtrado ? ' encontrados' : ''}` : '') : ' '}</p>
      {erro && <p role="alert" className="mt-2 rounded-xl bg-[#fdf0ee] px-3 py-2 text-[0.82rem] font-medium text-[#b3261e]">{erro}</p>}

      {!dados && carregando && <ul className="mt-2 space-y-2.5" aria-hidden>{Array.from({ length: 8 }, (_, i) => <li key={i} className="skeleton h-[84px]" />)}</ul>}
      {dados && total === 0 && !carregando && (
        <div className="card mt-2 px-4 py-12 text-center"><p className="font-semibold">Nenhum aluno encontrado</p><p className="text-[0.85rem] text-ink/55">{filtrado ? 'Tente outra busca ou limpe os filtros.' : 'Os alunos aparecem aqui assim que se cadastram.'}</p></div>
      )}

      <ul className={`mt-2 space-y-2.5 transition-opacity ${carregando && dados ? 'opacity-55' : ''}`}>
        {dados?.itens.map((a) => (
          <li key={a.id} className="card flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5 sm:p-4">
            <FotoPerfil aluno={a} size={52} />
            <div className="min-w-0 flex-1 basis-[220px] leading-tight">
              <p className="truncate text-[1rem] font-bold">{nomeLimpo(a.nome)}</p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-[0.8rem] text-ink/65"><Mail size={13} className="shrink-0 text-gold-600" /><span className="truncate">{a.email}</span></p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[0.78rem] text-ink/60">
                <span className="inline-flex items-center gap-1"><IdCard size={13} className="text-gold-600" />{a.matricula ?? 'Sem matrícula'}</span>
                <span className="inline-flex items-center gap-1"><IconeCpf size={13} className="text-gold-600" />{a.cpf ? mascaraCpf(a.cpf) : 'CPF não informado'}</span>
                <span className="inline-flex items-center gap-1"><MapPin size={13} className="text-gold-600" />{a.cidade ?? 'Sem cidade'}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays size={13} className="text-gold-600" />Cadastro em {fmtDia(a.created_at)}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 sm:ml-auto">
              <p className="text-right text-[0.78rem] leading-tight text-gold-700"><b className="block text-[1rem]">{a.fotos.toLocaleString('pt-BR')}</b>foto(s) · {a.atendimentos} atend.</p>
              <button type="button" onClick={() => setVer(a)} className="btn btn-line !min-h-[40px] !gap-1.5 !rounded-lg !px-3 !text-[0.8rem]"><Images size={15} />Ver fotos</button>
            </div>
          </li>
        ))}
      </ul>

      {total > por && (
        <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => irPagina(pagina - 1)} disabled={pagina === 0 || carregando} className="btn btn-line !min-h-[40px] !gap-1 !px-3.5 !text-[0.82rem]"><ChevronLeft size={16} />Anterior</button>
          <span className="text-[0.8rem] font-medium text-ink/65">Página {pagina + 1} de {paginas}</span>
          <button type="button" onClick={() => irPagina(pagina + 1)} disabled={pagina + 1 >= paginas || carregando} className="btn btn-line !min-h-[40px] !gap-1 !px-3.5 !text-[0.82rem]">Próxima<ChevronRight size={16} /></button>
        </nav>
      )}
      {ver && <FotosAluno aluno={ver} onFechar={() => setVer(null)} />}
    </section>
  );
}

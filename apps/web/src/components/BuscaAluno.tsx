'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { nomeLimpo } from '@/lib/session';

type Item = { id: number; nome: string; matricula: string | null; cidade: string | null };
const MIN = 3;

/** Filtro de aluno com busca no servidor: só pesquisa com 3+ caracteres e lista no máximo 20 (não carrega todos os cadastros). */
export default function BuscaAluno({ valor, rotuloExterno, onChange }: { valor: string; rotuloExterno?: string; onChange: (id: string) => void }) {
  const [texto, setTexto] = useState('');
  const [rotulo, setRotulo] = useState('');
  const [itens, setItens] = useState<Item[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => { if (!valor) setRotulo(''); }, [valor]);

  useEffect(() => {
    const t = texto.trim();
    if (t.length < MIN) { setItens([]); setCarregando(false); return; }
    setCarregando(true);
    const n = ++seq.current;
    const h = setTimeout(() => {
      api<Item[]>(`/admin/alunos/busca?q=${encodeURIComponent(t)}`)
        .then((r) => { if (n === seq.current) { setItens(r); setAtivo(0); } })
        .catch(() => { if (n === seq.current) setItens([]); })
        .finally(() => { if (n === seq.current) setCarregando(false); });
    }, 250);
    return () => clearTimeout(h);
  }, [texto]);

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  function escolher(a: Item) {
    setRotulo(`${nomeLimpo(a.nome)}${a.matricula ? ` (${a.matricula})` : ''}`);
    setTexto(''); setItens([]); setAberto(false);
    onChange(String(a.id));
  }
  function limpar() { setRotulo(''); setTexto(''); setItens([]); onChange(''); }

  const nome = valor ? rotulo || rotuloExterno || `Aluno #${valor}` : '';
  const t = texto.trim();

  return (
    <div ref={raiz} className="relative mt-1">
      {nome ? (
        <div className="field-plain flex items-center justify-between gap-2 !py-0"><span className="truncate py-2.5">{nome}</span>
          <button type="button" onClick={limpar} aria-label="Remover filtro de aluno" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-sand"><X size={15} /></button>
        </div>
      ) : (
        <>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" aria-hidden />
          <input value={texto} onChange={(e) => { setTexto(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => Math.min(i + 1, itens.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter' && itens[ativo]) { e.preventDefault(); escolher(itens[ativo]); }
              else if (e.key === 'Escape') setAberto(false);
            }}
            placeholder="Buscar aluno (3+ letras)" aria-label="Buscar aluno" role="combobox" aria-controls="lista-alunos" aria-expanded={aberto} autoComplete="off" className="field-plain !pl-9" />
          {aberto && (
            <ul id="lista-alunos" role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-soft">
              {t.length < MIN && <li className="px-3 py-2.5 text-[0.82rem] text-ink/55">Digite ao menos {MIN} caracteres para buscar.</li>}
              {t.length >= MIN && carregando && <li className="px-3 py-2.5 text-[0.82rem] text-ink/55">Buscando…</li>}
              {t.length >= MIN && !carregando && itens.length === 0 && <li className="px-3 py-2.5 text-[0.82rem] text-ink/55">Nenhum aluno encontrado.</li>}
              {itens.map((a, i) => (
                <li key={a.id} role="option" aria-selected={i === ativo}>
                  <button type="button" onMouseEnter={() => setAtivo(i)} onClick={() => escolher(a)} className={`block w-full px-3 py-2 text-left text-[0.88rem] ${i === ativo ? 'bg-ivory' : ''}`}>
                    <span className="font-semibold">{nomeLimpo(a.nome)}</span>
                    <span className="block text-[0.72rem] text-ink/55">{a.matricula ?? 'sem matrícula'}{a.cidade ? ` · ${a.cidade}` : ''}</span>
                  </button>
                </li>
              ))}
              {itens.length === 20 && <li className="px-3 py-2 text-[0.72rem] text-ink/45">Mostrando os 20 primeiros. Refine a busca.</li>}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

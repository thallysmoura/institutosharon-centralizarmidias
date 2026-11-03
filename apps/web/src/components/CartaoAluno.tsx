'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Images, Mail, MapPin, IdCard, X } from 'lucide-react';
import { API } from '@/lib/api';
import { nomeLimpo } from '@/lib/session';

type Aluno = { id: number; nome: string; matricula: string | null; email?: string; foto?: string | null };

/** Foto de perfil redonda; sem foto (ou se falhar) mostra a inicial do nome. */
export function FotoPerfil({ aluno, size = 24 }: { aluno: Pick<Aluno, 'nome' | 'foto'>; size?: number }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#f6efe0] font-bold text-gold-700" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {aluno.foto && !falhou
        ? <img src={`${API}${aluno.foto}`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFalhou(true)} className="h-full w-full object-cover" />
        : nomeLimpo(aluno.nome).charAt(0).toUpperCase()}
    </span>
  );
}

/** Cartão flutuante com os dados de quem enviou a foto, ancorado no badge clicado. Fecha com clique fora, Esc ou rolagem. */
export default function CartaoAluno({ aluno, cidade, ancora, onFechar, onVerFotos }: { aluno: Aluno; cidade: string; ancora: DOMRect; onFechar: () => void; onVerFotos: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: ancora.bottom + 8, left: ancora.left });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = Math.max(8, Math.min(ancora.left, window.innerWidth - w - 8));
    const abaixo = ancora.bottom + 8 + h <= window.innerHeight - 8;
    setPos({ left, top: abaixo ? ancora.bottom + 8 : Math.max(8, ancora.top - h - 8) });
  }, [ancora]);

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onFechar(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', onFechar, true);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); window.removeEventListener('scroll', onFechar, true); };
  }, [onFechar]);

  const linhas: [typeof IdCard, string | null | undefined][] = [[IdCard, aluno.matricula ? `Matrícula ${aluno.matricula}` : 'Sem matrícula'], [Mail, aluno.email], [MapPin, cidade]];
  return createPortal(
    <div ref={ref} role="dialog" aria-label={`Dados de ${nomeLimpo(aluno.nome)}`} className="pop fixed z-[95] w-[288px] max-w-[calc(100vw-16px)] rounded-2xl border border-line bg-white p-4 shadow-[0_24px_60px_-20px_rgba(33,24,13,.55)]" style={{ top: pos.top, left: pos.left }}>
      <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full text-ink/50 hover:bg-sand"><X size={15} /></button>
      <div className="flex items-center gap-3 pr-6">
        <FotoPerfil aluno={aluno} size={52} />
        <div className="min-w-0 leading-tight"><p className="truncate text-[1rem] font-bold">{nomeLimpo(aluno.nome)}</p><p className="text-[0.74rem] font-semibold text-gold-700">Aluno</p></div>
      </div>
      <ul className="mt-3 space-y-1.5 text-[0.82rem] text-ink/75">
        {linhas.filter(([, t]) => t).map(([Icone, t]) => <li key={t} className="flex items-center gap-2"><Icone size={15} className="shrink-0 text-gold-600" /><span className="min-w-0 truncate">{t}</span></li>)}
      </ul>
      <button type="button" onClick={onVerFotos} className="btn btn-gold mt-3.5 !min-h-[40px] w-full !gap-2 !text-[0.85rem]"><Images size={16} />Ver fotos deste aluno</button>
    </div>,
    document.body,
  );
}

import type { LucideIcon } from 'lucide-react';

const TAM = {
  1: { tag: 'h1', caixa: 'h-12 w-12 rounded-2xl', icone: 24, texto: 'text-[1.9rem] sm:text-[2.3rem] leading-tight' },
  2: { tag: 'h2', caixa: 'h-10 w-10 rounded-xl', icone: 20, texto: 'text-[1.45rem] leading-tight' },
  3: { tag: 'h3', caixa: 'h-8 w-8 rounded-[0.65rem]', icone: 17, texto: 'text-[1.1rem] leading-tight' },
} as const;

/** Título com ícone em medalhão dourado (identidade do Instituto Sharon: dourado + marrom). */
export default function Titulo({ nivel = 2, icone: Icone, children, className = '' }: { nivel?: 1 | 2 | 3; icone: LucideIcon; children: React.ReactNode; className?: string }) {
  const t = TAM[nivel];
  const H = t.tag;
  const anima = nivel < 3 ? 'titulo-anim' : ''; // títulos de tela aparecem animados; os de bloco ficam estáticos
  const chave = typeof children === 'string' ? children : undefined; // trocar de tela refaz a animação
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span key={`i-${chave ?? ''}`} aria-hidden className={`${nivel < 3 ? 'icone-anim ' : ''}grid shrink-0 place-items-center text-white shadow-[0_8px_18px_-8px_rgba(166,124,38,.75),inset_0_1px_0_rgba(255,255,255,.35)] ${t.caixa}`} style={{ background: 'linear-gradient(145deg,#f1cf79 0%,#c9a24a 52%,#a67c26 100%)' }}>
        <Icone size={t.icone} strokeWidth={1.6} />
      </span>
      <H key={chave} className={`font-bold text-[#33240F] ${anima} ${t.texto}`}>{children}</H>
    </div>
  );
}

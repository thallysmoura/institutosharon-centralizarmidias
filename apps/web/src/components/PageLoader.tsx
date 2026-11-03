/** Carregamento com a identidade do Instituto: o mesmo círculo dourado girando usado no site (sem texto). */
export function GoldSpinner({ className = 'h-14 w-14' }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 50" className={`animate-spin text-gold-500 ${className}`} fill="none" role="status" aria-label="Carregando">
      <circle cx="25" cy="25" r="20" stroke="currentColor" strokeOpacity=".2" strokeWidth="4" />
      <path d="M25 5a20 20 0 0 1 20 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Tela inteira (login/redirecionamentos) ou área do conteúdo (`inline`). */
export default function PageLoader({ inline = false }: { inline?: boolean }) {
  return inline ? (
    <div className="grid place-items-center py-16"><GoldSpinner className="h-11 w-11" /></div>
  ) : (
    <div className="grid min-h-dvh place-items-center bg-ivory/80 backdrop-blur-sm"><GoldSpinner /></div>
  );
}

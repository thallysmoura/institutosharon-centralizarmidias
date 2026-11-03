/** Indicador de carregamento (círculo girando), herda a cor do texto. */
export default function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 50 50" width={size} height={size} className="animate-spin" fill="none" aria-hidden>
      <circle cx="25" cy="25" r="20" stroke="currentColor" strokeOpacity=".25" strokeWidth="5" />
      <path d="M25 5a20 20 0 0 1 20 20" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

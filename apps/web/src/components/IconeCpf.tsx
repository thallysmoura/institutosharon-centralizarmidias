/** Ícone de documento (CPF), na cor do texto atual (currentColor) para seguir a identidade visual. */
export default function IconeCpf({ size = 24, className, ...resto }: { size?: number | string; className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height={size} width={size} fill="currentColor" className={className} aria-hidden={resto['aria-hidden'] ?? true}>
      <path d="M7,17h7V15H7v2Zm0-4H17V11H7v2ZM7,9H17V7H7V9ZM5,21q-0.83,0-1.41-0.59T3,19V5Q3,4.17 3.59,3.59T5,3H19q0.83,0 1.41,0.59T21,5V19q0,0.82-0.59,1.41T19,21H5Zm0-2H19V5H5V19ZM5,5V19V5Z" />
    </svg>
  );
}

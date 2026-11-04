import Image from 'next/image';
import Link from 'next/link';

/** Marca do Instituto: emblema + "INSTITUTO SHARON / EDUCAÇÃO E SAÚDE". `stacked` = centralizada (login); inline = lado a lado (sidebar/cabeçalho). */
export function Wordmark({ stacked = false, light = false }: { stacked?: boolean; light?: boolean }) {
  const txt = light ? 'text-white' : 'text-ink';
  if (stacked)
    return (
      <Link href="/" aria-label="Ir para a tela inicial" className="flex select-none flex-col items-center text-center">
        <Image src="/img/emblem.png" alt="" width={958} height={1624} priority draggable={false} className="pointer-events-none h-[74px] w-auto" />
        <p className={`mt-3 font-display text-[0.8rem] tracking-[0.6em] ${txt}`}>INSTITUTO</p>
        <p className={`-mt-0.5 font-display text-[2.6rem] leading-[1.05] tracking-[0.2em] ${txt}`}>SHARON</p>
        <p className="mt-1 text-[0.58rem] font-semibold tracking-[0.42em] text-gold-500">EDUCAÇÃO E SAÚDE</p>
      </Link>
    );
  return (
    <div className="flex select-none items-center gap-2.5">
      <Image src="/img/emblem.png" alt="" width={958} height={1624} priority draggable={false} className="pointer-events-none h-[34px] w-auto lg:h-10" />
      <div className="leading-none">
        <p className={`font-display text-[0.44rem] tracking-[0.5em] lg:text-[0.5rem] ${txt}`}>INSTITUTO</p>
        <p className={`mt-0.5 font-display text-[1.12rem] tracking-[0.16em] lg:text-[1.3rem] ${txt}`}>SHARON</p>
        <p className="mt-0.5 text-[0.35rem] font-semibold tracking-[0.34em] lg:text-[0.4rem] text-gold-500">EDUCAÇÃO E SAÚDE</p>
      </div>
    </div>
  );
}

/** Fitas douradas decorativas (canto superior esquerdo e inferior direito), como no layout de login. */
export function Ribbons() {
  return (
    <>
      <svg aria-hidden viewBox="0 0 400 220" className="pointer-events-none absolute bottom-0 right-0 w-[88%] max-w-[620px]">
        <defs>
          <linearGradient id="gr1" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#f3e2a6" stopOpacity=".15" />
            <stop offset=".45" stopColor="#d3ac52" stopOpacity=".75" />
            <stop offset="1" stopColor="#f6e7b4" stopOpacity=".9" />
          </linearGradient>
        </defs>
        <path d="M0 220C90 170 230 150 400 72V130C250 190 110 205 40 220Z" fill="url(#gr1)" />
        <path d="M60 220C170 188 300 165 400 108V150C310 196 190 212 120 220Z" fill="url(#gr1)" opacity=".6" />
      </svg>
      <svg aria-hidden viewBox="0 0 200 120" className="pointer-events-none absolute left-0 top-0 w-[48%] max-w-[260px]">
        <defs>
          <linearGradient id="gr2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e0bd62" stopOpacity=".95" />
            <stop offset="1" stopColor="#f6e7b4" stopOpacity=".2" />
          </linearGradient>
        </defs>
        <path d="M0 0H120C80 28 40 52 0 92Z" fill="url(#gr2)" />
      </svg>
    </>
  );
}

/** Emblema "S" em dourado chapado (a imagem do emblema serve só de máscara). */
export function Emblema({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  const m = 'url(/img/emblem.png) center / contain no-repeat';
  return <span aria-hidden className={`inline-block shrink-0 ${className}`} style={{ aspectRatio: '958 / 1624', WebkitMask: m, mask: m, background: 'linear-gradient(155deg,#f6cf63 0%,#e0a52b 45%,#b9801a 100%)', ...style }} />;
}

/** Marca horizontal do login: emblema + INSTITUTO / SHARON / EDUCAÇÃO E SAÚDE. O tamanho vem do font-size do elemento. */
export function Logo({ light = false, style }: { light?: boolean; style?: React.CSSProperties }) {
  return (
    <Link href="/" aria-label="Ir para a tela inicial" draggable={false} className="flex select-none items-center" style={{ gap: '0.5em', ...style }}>
      <Emblema style={{ height: '2.2em' }} />
      <div className="leading-none">
        <p className={`font-sans font-semibold ${light ? 'text-white' : 'text-[#33240F]'}`} style={{ fontSize: '0.42em', letterSpacing: '0.55em' }}>INSTITUTO</p>
        <p className={`font-sans font-semibold ${light ? 'text-white' : 'text-[#33240F]'}`} style={{ fontSize: '1em', letterSpacing: '0.2em', marginTop: '0.08em' }}>SHARON</p>
        <p className="font-sans font-medium text-[#c18a1e]" style={{ fontSize: '0.32em', letterSpacing: '0.42em', marginTop: '0.35em' }}>EDUCAÇÃO E SAÚDE</p>
      </div>
    </Link>
  );
}

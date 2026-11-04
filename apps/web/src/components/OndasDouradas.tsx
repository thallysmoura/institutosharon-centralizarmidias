/** Ondas douradas decorativas do topo do painel administrativo: faixas de seda com brilho e fios finos, atrás do conteúdo. */
export default function OndasDouradas() {
  return (
    <svg aria-hidden viewBox="0 0 900 280" preserveAspectRatio="xMaxYMin slice" className="pointer-events-none absolute right-0 top-0 -z-10 hidden h-[280px] w-[72%] max-w-[980px] lg:block">
      <defs>
        <linearGradient id="onda1" x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#f3dfa6" stopOpacity="0" />
          <stop offset=".45" stopColor="#e9c872" stopOpacity=".35" />
          <stop offset=".72" stopColor="#d9a93f" stopOpacity=".55" />
          <stop offset="1" stopColor="#f6e6b8" stopOpacity=".15" />
        </linearGradient>
        <linearGradient id="onda2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff7de" stopOpacity=".9" />
          <stop offset="1" stopColor="#f0d58c" stopOpacity=".2" />
        </linearGradient>
        <linearGradient id="fio" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9a24a" stopOpacity="0" />
          <stop offset=".5" stopColor="#c9a24a" stopOpacity=".55" />
          <stop offset="1" stopColor="#c9a24a" stopOpacity=".05" />
        </linearGradient>
        <radialGradient id="brilho" cx=".78" cy=".1" r=".6"><stop offset="0" stopColor="#f2c14e" stopOpacity=".32" /><stop offset="1" stopColor="#f2c14e" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="900" height="280" fill="url(#brilho)" />
      <path d="M120 40 C 300 130, 470 -10, 640 60 S 820 110, 900 50 L900 0 L260 0 C 210 10, 160 20, 120 40 Z" fill="url(#onda1)" />
      <path d="M300 0 C 420 70, 560 80, 700 40 S 850 -10, 900 20 L900 0 Z" fill="url(#onda2)" />
      <path d="M180 70 C 340 170, 500 20, 680 90 S 840 150, 900 100" fill="none" stroke="url(#fio)" strokeWidth="1.4" />
      <path d="M210 55 C 370 150, 520 10, 700 76 S 850 130, 900 82" fill="none" stroke="url(#fio)" strokeWidth="1" />
      <path d="M240 40 C 400 130, 540 0, 720 62 S 860 112, 900 64" fill="none" stroke="url(#fio)" strokeWidth=".8" />
      <path d="M150 95 C 320 190, 480 50, 660 118 S 830 175, 900 128" fill="none" stroke="url(#fio)" strokeWidth=".8" />
      <path d="M260 110 C 420 190, 560 80, 740 130 S 870 170, 900 150" fill="none" stroke="url(#fio)" strokeWidth=".7" />
    </svg>
  );
}

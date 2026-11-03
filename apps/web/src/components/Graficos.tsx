'use client';
import { useState } from 'react';

const OURO = '#a67c26';
const OURO_CLARO = '#e7b23c';
const MARROM = '#33240F';
export const PALETA = [OURO, MARROM, OURO_CLARO, '#8d6a3f', '#d9c8a0'];

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const num = (n: number) => n.toLocaleString('pt-BR');
/** Máximo "redondo" para o eixo Y (4, 5, 10, 20, 50...). */
const teto = (m: number) => { if (m <= 4) return 4; const p = 10 ** Math.floor(Math.log10(m)); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

type Dia = { dia: string; fotos: number; atendimentos: number };

/** Evolução diária: área dourada (fotos) + linha tracejada (atendimentos), com dica ao tocar/passar o mouse. */
export function GraficoDias({ dados }: { dados: Dia[] }) {
  const [i, setI] = useState<number | null>(null);
  const W = 640, H = 230, L = 38, R = 12, T = 14, B = 28;
  const max = teto(Math.max(1, ...dados.map((d) => Math.max(d.fotos, d.atendimentos))));
  const x = (k: number) => L + (dados.length <= 1 ? 0 : (k * (W - L - R)) / (dados.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const linha = (f: (d: Dia) => number) => dados.map((d, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${y(f(d)).toFixed(1)}`).join(' ');
  const area = `${linha((d) => d.fotos)} L${x(dados.length - 1).toFixed(1)} ${H - B} L${L} ${H - B} Z`;
  const passo = Math.max(1, Math.ceil(dados.length / 6));
  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setI(Math.min(dados.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (dados.length - 1)))));
  };
  const d = i != null ? dados[i] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-pan-y select-none" role="img" aria-label="Fotos e atendimentos por dia" onPointerMove={mover} onPointerLeave={() => setI(null)}>
        <defs><linearGradient id="gdias" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={OURO_CLARO} stopOpacity=".55" /><stop offset="1" stopColor={OURO_CLARO} stopOpacity=".03" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map((k) => {
          const v = (max / 4) * k;
          return <g key={k}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#eadfc9" strokeDasharray={k ? '3 4' : undefined} /><text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#8a7a62">{num(Math.round(v))}</text></g>;
        })}
        {dados.map((p, k) => (k % passo === 0 || k === dados.length - 1) && <text key={p.dia} x={x(k)} y={H - 8} textAnchor="middle" fontSize="11" fill="#8a7a62">{dm(p.dia)}</text>)}
        <path d={area} fill="url(#gdias)" />
        <path d={linha((p) => p.fotos)} fill="none" stroke={OURO} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <path d={linha((p) => p.atendimentos)} fill="none" stroke={MARROM} strokeWidth="1.8" strokeDasharray="5 4" strokeLinejoin="round" />
        {i != null && d && (
          <g>
            <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} stroke={OURO} strokeOpacity=".4" />
            <circle cx={x(i)} cy={y(d.fotos)} r="4.5" fill="#fff" stroke={OURO} strokeWidth="2.4" />
            <circle cx={x(i)} cy={y(d.atendimentos)} r="3.5" fill="#fff" stroke={MARROM} strokeWidth="1.8" />
          </g>
        )}
      </svg>
      {i != null && d && (
        <div className="pointer-events-none absolute top-1 rounded-lg bg-[#33240F] px-3 py-2 text-[0.75rem] text-white shadow-lg" style={{ left: `${(x(i) / W) * 100}%`, transform: `translateX(${i > dados.length * 0.6 ? '-105%' : '8%'})` }}>
          <p className="font-semibold">{dm(d.dia)}</p>
          <p><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#e7b23c]" />{num(d.fotos)} foto(s)</p>
          <p><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-white/80" />{num(d.atendimentos)} atendimento(s)</p>
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-ink/60">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#a67c26]" />Fotos</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-[#33240F]" />Atendimentos</span>
      </div>
    </div>
  );
}

/** Rosca com total no centro e legenda com percentuais. */
export function Rosca({ itens }: { itens: { nome: string; n: number }[] }) {
  const total = itens.reduce((s, x) => s + x.n, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:flex-col xl:flex-row">
      <svg viewBox="0 0 140 140" className="h-[150px] w-[150px] shrink-0" role="img" aria-label="Distribuição por dispositivo">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f1ece1" strokeWidth="16" />
        {total > 0 && itens.map((x, k) => {
          const len = (x.n / total) * C;
          const el = <circle key={x.nome} cx="70" cy="70" r={R} fill="none" stroke={PALETA[k % PALETA.length]} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />;
          acc += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="700" fill={MARROM}>{num(total)}</text>
        <text x="70" y="85" textAnchor="middle" fontSize="10" fill="#8a7a62">fotos</text>
      </svg>
      <ul className="w-full min-w-0 space-y-2 text-[0.85rem]">
        {itens.map((x, k) => (
          <li key={x.nome} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PALETA[k % PALETA.length] }} />
            <span className="min-w-0 flex-1 truncate">{x.nome}</span>
            <span className="font-semibold">{num(x.n)}</span>
            <span className="w-10 text-right text-ink/50">{total ? Math.round((x.n / total) * 100) : 0}%</span>
          </li>
        ))}
        {itens.length === 0 && <li className="text-ink/50">Sem dados no período.</li>}
      </ul>
    </div>
  );
}

/** Barras horizontais com rótulo, valor e subtítulo opcional (cidades, ranking de alunos). */
export function BarrasH({ itens, vazio = 'Sem dados no período.' }: { itens: { rotulo: string; sub?: string; valor: number }[]; vazio?: string }) {
  const max = Math.max(1, ...itens.map((x) => x.valor));
  if (!itens.length) return <p className="py-6 text-center text-[0.85rem] text-ink/50">{vazio}</p>;
  return (
    <ul className="space-y-3">
      {itens.map((x, k) => (
        <li key={`${x.rotulo}-${k}`}>
          <div className="flex items-baseline justify-between gap-3 text-[0.86rem]">
            <span className="min-w-0 truncate font-semibold"><span className="mr-2 inline-block w-4 text-[0.75rem] font-bold text-gold-600">{k + 1}</span>{x.rotulo}</span>
            <span className="shrink-0 text-ink/70"><b className="text-ink">{num(x.valor)}</b> foto(s)</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f1ece1]"><div className="grow-bar h-full rounded-full" style={{ width: `${(x.valor / max) * 100}%`, background: 'linear-gradient(90deg,#e7b23c,#a67c26)' }} /></div>
          {x.sub && <p className="mt-0.5 truncate text-[0.72rem] text-ink/50">{x.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Movimento por hora do dia (0h-23h); destaca o horário de pico. */
export function GraficoHoras({ dados }: { dados: { hora: number; fotos: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.fotos));
  const pico = dados.reduce((a, b) => (b.fotos > a.fotos ? b : a), dados[0]);
  const W = 480, H = 130, B = 20, bw = W / 24;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Fotos por hora do dia">
        {dados.map((d) => {
          const h = Math.max(d.fotos ? 4 : 2, (d.fotos / max) * (H - B - 8));
          return (
            <g key={d.hora}>
              <rect x={d.hora * bw + 3} y={H - B - h} width={bw - 6} height={h} rx="3" fill={d.fotos && d.hora === pico.hora ? OURO : d.fotos ? '#e7c978' : '#efe7d6'}><title>{`${d.hora}h: ${d.fotos} foto(s)`}</title></rect>
              {d.hora % 3 === 0 && <text x={d.hora * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize="10" fill="#8a7a62">{d.hora}h</text>}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[0.8rem] text-ink/60">{pico.fotos > 0 ? <>Horário de pico: <b className="text-ink">{pico.hora}h às {pico.hora + 1}h</b> ({num(pico.fotos)} foto(s))</> : 'Sem envios no período.'}</p>
    </div>
  );
}

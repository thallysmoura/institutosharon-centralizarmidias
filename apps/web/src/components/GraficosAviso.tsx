'use client';
import { PALETA } from './Graficos';

const num = (n: number) => n.toLocaleString('pt-BR');
const OURO = PALETA[0];

/** Rosca de leitura: percentual dos destinatários que já leram. */
export function RoscaLeitura({ lidos, total }: { lidos: number; total: number }) {
  const R = 52, C = 2 * Math.PI * R;
  const pct = total ? lidos / total : 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="h-[130px] w-[130px] shrink-0" role="img" aria-label={`${Math.round(pct * 100)}% leram`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f1ece1" strokeWidth="16" />
        {pct > 0 && <circle cx="70" cy="70" r={R} fill="none" stroke={OURO} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${Math.max(0, pct * C - 1)} ${C}`} transform="rotate(-90 70 70)" />}
        <text x="70" y="77" textAnchor="middle" fontSize="26" fontWeight="700" fill="#33240F">{Math.round(pct * 100)}%</text>
      </svg>
      <ul className="space-y-2 text-[0.85rem]">
        <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: OURO }} />Leram <b>{num(lidos)}</b></li>
        <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#f1ece1]" />Pendentes <b>{num(Math.max(0, total - lidos))}</b></li>
      </ul>
    </div>
  );
}

/** Leitura por cidade: barra preenchida = leram, trilho = total de destinatários. */
export function BarrasCidade({ itens }: { itens: { nome: string; total: number; lidos: number }[] }) {
  if (!itens.length) return <p className="py-4 text-center text-[0.85rem] text-ink/50">Sem dados.</p>;
  return (
    <ul className="space-y-2.5">
      {itens.map((x) => (
        <li key={x.nome}>
          <div className="flex items-baseline justify-between gap-3 text-[0.82rem]"><span className="min-w-0 truncate font-semibold">{x.nome}</span><span className="shrink-0 text-ink/60"><b className="text-ink">{num(x.lidos)}</b> de {num(x.total)}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f1ece1]"><div className="h-full rounded-full" style={{ width: `${x.total ? (x.lidos / x.total) * 100 : 0}%`, background: 'linear-gradient(90deg,#a67c26,#e7b23c)' }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Evolução acumulada das leituras (por hora nos primeiros dias, por dia depois). */
export function SerieLeituras({ pontos, gran }: { pontos: { t: string; n: number }[]; gran: 'hour' | 'day' }) {
  if (!pontos.length) return <p className="py-4 text-center text-[0.85rem] text-ink/50">Ninguém leu ainda.</p>;
  let acc = 0;
  const ac = pontos.map((p) => ({ t: p.t, v: (acc += p.n) }));
  const W = 560, H = 150, L = 30, R = 10, T = 12, B = 24;
  const max = Math.max(1, acc);
  const x = (i: number) => L + (ac.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (ac.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const linha = ac.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const rot = (iso: string) => { const d = new Date(iso); return gran === 'hour' ? `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.getHours()}h` : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução das leituras">
      {[0, 0.5, 1].map((f) => <line key={f} x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="#f1ece1" />)}
      <text x={L - 5} y={y(max) + 4} textAnchor="end" fontSize="10" fill="#8a7a62">{num(max)}</text>
      <text x={L - 5} y={y(0) + 4} textAnchor="end" fontSize="10" fill="#8a7a62">0</text>
      <path d={`${linha} L${x(ac.length - 1)} ${H - B} L${x(0)} ${H - B} Z`} fill={OURO} opacity=".14" />
      <path d={linha} fill="none" stroke={OURO} strokeWidth="2.2" strokeLinejoin="round" />
      {ac.length <= 40 && ac.map((p, i) => <circle key={p.t} cx={x(i)} cy={y(p.v)} r="2.6" fill={OURO} />)}
      <text x={L} y={H - 6} fontSize="10" fill="#8a7a62">{rot(ac[0].t)}</text>
      {ac.length > 1 && <text x={W - R} y={H - 6} textAnchor="end" fontSize="10" fill="#8a7a62">{rot(ac[ac.length - 1].t)}</text>}
    </svg>
  );
}

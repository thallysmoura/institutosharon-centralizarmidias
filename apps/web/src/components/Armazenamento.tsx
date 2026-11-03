'use client';
import { useEffect, useState } from 'react';
import { Cloud, Database, ImageIcon, PenLine, Eye, TriangleAlert, CircleCheck, MapPin } from 'lucide-react';
import Titulo from './Titulo';
import { api } from '@/lib/api';
import PageLoader from '@/components/PageLoader';

type Resumo = {
  driver: 'local' | 's3';
  bucket: string | null;
  prefixo: string | null;
  fotos: number;
  bytes: number;
  mediaBytes: number;
  mes: { classeA: number; classeB: number };
  porCidade: { cidade: string; fotos: number; bytes: number }[];
  limites: { bytes: number; classeA: number; classeB: number };
  precos: { gbMes: number; classeA: number; classeB: number };
};

const GB = 1024 ** 3;
const fmtBytes = (b: number) => (b >= GB ? `${(b / GB).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const n = (v: number) => v.toLocaleString('pt-BR');
const usd = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Barra({ titulo, Icon, usado, limite, rotulo, falta }: { titulo: string; Icon: typeof Cloud; usado: number; limite: number; rotulo: string; falta: string }) {
  const pct = Math.min(100, (usado / limite) * 100);
  const cor = pct >= 100 ? '#b3261e' : pct >= 80 ? '#c77c0a' : '#a67c26';
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Icon size={20} strokeWidth={1.6} /></span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[0.82rem] font-semibold text-ink/70">{titulo}</p>
          <p className="text-[1.25rem] font-bold">{rotulo}</p>
        </div>
        <span className="text-[1.1rem] font-bold" style={{ color: cor }}>{pct < 0.1 && usado > 0 ? '<0,1' : pct.toFixed(pct < 10 ? 1 : 0)}%</span>
      </div>
      <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={titulo} className="mt-4 h-3 overflow-hidden rounded-full bg-[#f1ece1]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, usado > 0 ? 1.5 : 0)}%`, background: `linear-gradient(90deg, #d9b655, ${cor})` }} />
      </div>
      <p className="mt-2 text-[0.8rem] text-ink/60">{falta}</p>
    </div>
  );
}

/** Gestão do armazenamento: uso do armazenamento frente ao limite gratuito mensal (o que falta para a cobrança começar). */
export default function Armazenamento() {
  const [d, setD] = useState<Resumo>();
  const [erro, setErro] = useState('');
  useEffect(() => { api<Resumo>('/admin/armazenamento').then(setD).catch((e) => setErro((e as Error).message)); }, []);

  if (erro) return <p className="mt-6 text-sm text-ink/60">{erro}</p>;
  if (!d) return <PageLoader inline />;

  const faltaBytes = Math.max(0, d.limites.bytes - d.bytes);
  const fotosRestantes = d.mediaBytes > 0 ? Math.floor(faltaBytes / (d.mediaBytes * 1.06)) : null; // ~6% de miniatura por foto
  const excedente = {
    gb: Math.max(0, d.bytes - d.limites.bytes) / GB,
    a: Math.max(0, d.mes.classeA - d.limites.classeA),
    b: Math.max(0, d.mes.classeB - d.limites.classeB),
  };
  const custo = excedente.gb * d.precos.gbMes + excedente.a * d.precos.classeA + excedente.b * d.precos.classeB;
  const gratis = custo === 0;
  const maxCidade = Math.max(1, ...d.porCidade.map((c) => c.bytes));

  return (
    <div className="mt-6">
      <div className={`flex items-start gap-3 rounded-2xl border p-4 ${gratis ? 'border-[#cfe8d8] bg-[#eef8f2]' : 'border-[#f0cfc9] bg-[#fdf0ee]'}`}>
        {gratis ? <CircleCheck size={22} className="mt-0.5 shrink-0 text-[#17794a]" /> : <TriangleAlert size={22} className="mt-0.5 shrink-0 text-[#b3261e]" />}
        <div className="text-[0.88rem] leading-snug">
          <p className="font-bold">{gratis ? 'Dentro do limite gratuito do armazenamento' : `Acima do limite gratuito - estimativa de ${usd(custo)} neste mês`}</p>
          <p className="text-ink/70">
            {d.driver === 's3'
              ? `Armazenando na nuvem · pasta ${d.prefixo ?? '/'}`
              : 'Armazenamento local de teste. Ao ativar o armazenamento na nuvem, os números abaixo passam a refletir a cobrança real.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Barra titulo="Armazenamento usado" Icon={Database} usado={d.bytes} limite={d.limites.bytes} rotulo={`${fmtBytes(d.bytes)} de ${fmtBytes(d.limites.bytes)}`}
          falta={faltaBytes > 0 ? `Faltam ${fmtBytes(faltaBytes)} para o armazenamento começar a ser cobrado${fotosRestantes != null ? ` (cerca de ${n(fotosRestantes)} fotos)` : ''}.` : 'Limite gratuito atingido. Excedente cobrado a US$ 0,015 por GB/mês.'} />
        <Barra titulo="Mídias armazenadas" Icon={ImageIcon} usado={d.fotos} limite={Math.max(d.fotos, fotosRestantes != null ? d.fotos + fotosRestantes : d.fotos, 1)} rotulo={`${n(d.fotos)} foto${d.fotos === 1 ? '' : 's'}`}
          falta={d.fotos ? `Média de ${fmtBytes(d.mediaBytes)} por foto (alta qualidade, WebP) + miniatura.` : 'Nenhuma foto enviada ainda.'} />
        <Barra titulo="Operações de escrita (Classe A) no mês" Icon={PenLine} usado={d.mes.classeA} limite={d.limites.classeA} rotulo={`${n(d.mes.classeA)} de ${n(d.limites.classeA)}`}
          falta={`Faltam ${n(Math.max(0, d.limites.classeA - d.mes.classeA))} operações. Cada foto enviada gera 2 (original + miniatura).`} />
        <Barra titulo="Operações de leitura (Classe B) no mês" Icon={Eye} usado={d.mes.classeB} limite={d.limites.classeB} rotulo={`${n(d.mes.classeB)} de ${n(d.limites.classeB)}`}
          falta={`Faltam ${n(Math.max(0, d.limites.classeB - d.mes.classeB))} operações. Cada visualização de foto conta 1.`} />
      </div>

      <section className="card mt-4 p-5" aria-label="Uso por cidade">
        <Titulo icone={MapPin}>Uso por cidade</Titulo>
        <ul className="mt-3 space-y-3">
          {d.porCidade.map((c) => (
            <li key={c.cidade}>
              <div className="flex items-baseline justify-between text-[0.88rem]"><span className="font-semibold">{c.cidade}</span><span className="text-ink/60">{n(c.fotos)} foto(s) · {fmtBytes(c.bytes)}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f1ece1]"><div className="h-full rounded-full bg-gradient-to-r from-[#d9b655] to-[#a67c26]" style={{ width: `${(c.bytes / maxCidade) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-[0.78rem] leading-relaxed text-ink/55">
        Limites do plano gratuito do armazenamento, por mês: 10 GB de armazenamento, 1 milhão de operações de escrita (Classe A) e 10 milhões de leitura (Classe B). A saída de dados é gratuita.
        O limite vale para toda a conta de armazenamento, somando todos os projetos; este painel mostra apenas o consumo deste sistema, então o saldo real pode ser menor se outros projetos usam a mesma conta.
      </p>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { CircleCheck, Coins, HardDrive, ImageIcon, MapPin, TriangleAlert, Info } from 'lucide-react';
import Titulo from './Titulo';
import { api } from '@/lib/api';
import PageLoader from '@/components/PageLoader';

type Resumo = {
  driver: 'local' | 's3';
  fotos: number;
  bytes: number;
  mediaBytes: number;
  mes: { classeA: number; classeB: number };
  porCidade: { cidade: string; fotos: number; bytes: number }[];
  limites: { bytes: number; classeA: number; classeB: number };
  precos: { gbMes: number; classeA: number; classeB: number };
};

const GB = 1024 ** 3;
const fmtBytes = (b: number) => (b >= GB ? `${(b / GB).toFixed(2).replace('.', ',')} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1).replace('.', ',')} MB` : `${Math.round(b / 1024)} KB`);
const n = (v: number) => v.toLocaleString('pt-BR');
const usd = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pctTxt = (p: number, usado: number) => (p < 0.1 && usado > 0 ? 'menos de 0,1%' : `${p.toFixed(p < 10 ? 1 : 0).replace('.', ',')}%`);

function Barra({ pct, usado, aria }: { pct: number; usado: number; aria: string }) {
  const cor = pct >= 100 ? '#b3261e' : pct >= 80 ? '#c77c0a' : '#a67c26';
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={aria} className="h-3.5 overflow-hidden rounded-full bg-[#f1ece1]">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(pct, usado > 0 ? 1.5 : 0))}%`, background: `linear-gradient(90deg, #d9b655, ${cor})` }} />
    </div>
  );
}

function Destaque({ Icon, titulo, valor, nota }: { Icon: typeof HardDrive; titulo: string; valor: string; nota: string }) {
  return (
    <div className="card flex items-center gap-3.5 p-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Icon size={22} strokeWidth={1.6} /></span>
      <div className="min-w-0 leading-tight">
        <p className="text-[0.78rem] font-semibold text-ink/60">{titulo}</p>
        <p className="text-[1.45rem] font-bold">{valor}</p>
        <p className="text-[0.76rem] text-ink/55">{nota}</p>
      </div>
    </div>
  );
}

/** Armazenamento em linguagem simples: quanto espaço as fotos ocupam, quanto ainda cabe no plano gratuito e quanto isso custa. */
export default function Armazenamento() {
  const [d, setD] = useState<Resumo>();
  const [erro, setErro] = useState('');
  useEffect(() => { api<Resumo>('/admin/armazenamento').then(setD).catch((e) => setErro((e as Error).message)); }, []);

  if (erro) return <p className="mt-6 text-sm text-ink/60">{erro}</p>;
  if (!d) return <PageLoader inline />;

  const pctEspaco = (d.bytes / d.limites.bytes) * 100;
  const pctSalvar = (d.mes.classeA / d.limites.classeA) * 100;
  const pctVer = (d.mes.classeB / d.limites.classeB) * 100;
  const faltaBytes = Math.max(0, d.limites.bytes - d.bytes);
  const fotosRestantes = d.mediaBytes > 0 ? Math.floor(faltaBytes / (d.mediaBytes * 1.06)) : null; // inclui ~6% da miniatura de cada foto
  const custo = (Math.max(0, d.bytes - d.limites.bytes) / GB) * d.precos.gbMes + Math.max(0, d.mes.classeA - d.limites.classeA) * d.precos.classeA + Math.max(0, d.mes.classeB - d.limites.classeB) * d.precos.classeB;
  const maior = Math.max(pctEspaco, pctSalvar, pctVer);
  const nivel: 'ok' | 'atencao' | 'cobrando' = custo > 0 ? 'cobrando' : maior >= 80 ? 'atencao' : 'ok';
  const maxCidade = Math.max(1, ...d.porCidade.map((c) => c.bytes));

  const estilo = { ok: 'border-[#cfe8d8] bg-[#eef8f2]', atencao: 'border-[#f1dfb4] bg-[#fdf6e3]', cobrando: 'border-[#f0cfc9] bg-[#fdf0ee]' }[nivel];
  const titulo = { ok: 'Tudo certo. Seu armazenamento está dentro do plano gratuito.', atencao: 'Atenção: o espaço gratuito está acabando.', cobrando: `O plano gratuito foi ultrapassado. Custo estimado deste mês: ${usd(custo)}.` }[nivel];
  const texto = {
    ok: 'Você não paga nada por enquanto.',
    atencao: 'Ainda não há cobrança, mas vale se planejar para não passar do limite gratuito.',
    cobrando: 'O valor é uma estimativa e será cobrado pelo serviço de armazenamento.',
  }[nivel];

  return (
    <div className="mt-6">
      <div className={`flex items-start gap-3 rounded-2xl border p-4 ${estilo}`} role="status">
        {nivel === 'ok' ? <CircleCheck size={24} className="mt-0.5 shrink-0 text-[#17794a]" /> : <TriangleAlert size={24} className={`mt-0.5 shrink-0 ${nivel === 'atencao' ? 'text-[#c77c0a]' : 'text-[#b3261e]'}`} />}
        <div className="leading-snug">
          <p className="text-[1rem] font-bold">{titulo}</p>
          <p className="text-[0.86rem] text-ink/70">{texto}{d.driver !== 's3' && ' Os números abaixo são de teste: neste momento as fotos ficam guardadas só neste computador.'}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Destaque Icon={ImageIcon} titulo="Fotos guardadas" valor={n(d.fotos)} nota={d.fotos ? `Cada foto ocupa em média ${fmtBytes(d.mediaBytes)}` : 'Nenhuma foto enviada ainda'} />
        <Destaque Icon={HardDrive} titulo="Espaço ocupado" valor={fmtBytes(d.bytes)} nota={`de ${fmtBytes(d.limites.bytes)} gratuitos`} />
        <Destaque Icon={Coins} titulo="Custo deste mês" valor={custo > 0 ? usd(custo) : 'Grátis'} nota={custo > 0 ? 'Valor estimado' : 'Nada a pagar até agora'} />
      </div>

      <section className="card mt-4 p-5" aria-label="Espaço disponível">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[1.05rem] font-bold">Espaço disponível</h3>
          <p className="text-[0.9rem] text-ink/70"><b className="text-ink">{pctTxt(pctEspaco, d.bytes)}</b> usado</p>
        </div>
        <div className="mt-3"><Barra pct={pctEspaco} usado={d.bytes} aria="Espaço usado" /></div>
        <p className="mt-3 text-[0.88rem] text-ink/75">
          {faltaBytes > 0
            ? <>Ainda restam <b>{fmtBytes(faltaBytes)}</b> gratuitos{fotosRestantes != null && fotosRestantes > 0 ? <>, o suficiente para cerca de <b>{n(fotosRestantes)} fotos</b> novas</> : ''}.</>
            : 'O espaço gratuito acabou. O que passar disso é cobrado por mês.'}
        </p>
      </section>

      <section className="card mt-4 p-5" aria-label="Movimento do mês">
        <h3 className="text-[1.05rem] font-bold">Movimento deste mês</h3>
        <p className="mt-0.5 text-[0.82rem] text-ink/60">O plano gratuito também limita quantas vezes o sistema pode guardar e mostrar fotos.</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {[
            { t: 'Fotos guardadas no mês', usado: d.mes.classeA, lim: d.limites.classeA, pct: pctSalvar, dica: 'Cada foto enviada conta 2 vezes (a foto e a prévia).' },
            { t: 'Fotos visualizadas no mês', usado: d.mes.classeB, lim: d.limites.classeB, pct: pctVer, dica: 'Cada vez que uma foto é aberta ou aparece na tela, conta 1.' },
          ].map((x) => (
            <div key={x.t}>
              <div className="flex items-baseline justify-between gap-2 text-[0.88rem]"><span className="font-semibold">{x.t}</span><span className="text-ink/60">{pctTxt(x.pct, x.usado)} do limite</span></div>
              <div className="mt-2"><Barra pct={x.pct} usado={x.usado} aria={x.t} /></div>
              <p className="mt-1.5 text-[0.78rem] text-ink/55">{n(x.usado)} de {n(x.lim)}. {x.dica}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card mt-4 p-5" aria-label="Espaço por cidade">
        <Titulo icone={MapPin}>Espaço por cidade</Titulo>
        <ul className="mt-3 space-y-3">
          {d.porCidade.map((c) => (
            <li key={c.cidade}>
              <div className="flex items-baseline justify-between gap-3 text-[0.88rem]"><span className="font-semibold">{c.cidade}</span><span className="text-ink/60">{n(c.fotos)} foto(s) · {fmtBytes(c.bytes)}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f1ece1]"><div className="h-full rounded-full bg-gradient-to-r from-[#d9b655] to-[#a67c26]" style={{ width: `${(c.bytes / maxCidade) * 100}%` }} /></div>
            </li>
          ))}
          {d.porCidade.length === 0 && <li className="text-[0.85rem] text-ink/55">Ainda não há fotos.</li>}
        </ul>
      </section>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-sand/60 p-3.5 text-[0.78rem] leading-relaxed text-ink/60">
        <Info size={16} className="mt-0.5 shrink-0 text-gold-600" />
        <p>
          O plano gratuito inclui {fmtBytes(d.limites.bytes)} de espaço por mês. Acima disso, o custo é de cerca de {usd(d.precos.gbMes)} por GB a cada mês. Baixar ou ver as fotos não tem custo extra.
          Esse limite vale para toda a conta de armazenamento do Instituto; esta tela mostra só o que este sistema usa, então, se outros sistemas usam a mesma conta, o espaço real disponível pode ser menor.
        </p>
      </div>
    </div>
  );
}

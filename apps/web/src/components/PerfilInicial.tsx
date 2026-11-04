'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import IconeCpf from '@/components/IconeCpf';
import { cpfValido, mascaraCpf, soDigitos } from '@/lib/cpf';
import { ArrowLeft, ArrowRight, Check, CircleAlert, GraduationCap, LogOut, Mail, MapPin, Pencil, User } from 'lucide-react';
import { api, Me } from '@/lib/api';
import Avatar from './Avatar';
import { Logo } from './Brand';
import PinModal from './PinModal';
import Spinner from './Spinner';
import MsgErro from './MsgErro';
import AlterarSenha from './AlterarSenha';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/;

/** Primeiro acesso do aluno: mostra os dados do perfil (foto do Google, e-mail, cidade) e exige a matrícula antes de liberar o envio de mídias. */
export default function PerfilInicial({ me, sair, recarregar, modo = 'primeiro', onVoltar, embutido = false }: { me: Me; sair: () => void; recarregar: () => Promise<unknown> | void; modo?: 'primeiro' | 'config'; onVoltar?: () => void; embutido?: boolean }) {
  const config = modo === 'config';
  const [salvo, setSalvo] = useState(false);
  const [nome, setNome] = useState(me.nome.replace(/ \(.*\)$/, ''));
  const [matricula, setMatricula] = useState(me.matricula ?? '');
  const [cpf, setCpf] = useState(me.cpf ? mascaraCpf(me.cpf) : '');
  const cpfEstado = soDigitos(cpf).length === 11 ? (cpfValido(cpf) ? 'ok' : 'erro') : null; // verificação ao vivo
  const [erro, setErro] = useState('');
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});
  const falha = (campo: string, msg: string) => { setErro(''); setErrosCampo({ [campo]: msg }); };
  const limpar = (campo: string) => setErrosCampo((x) => { if (!x[campo]) return x; const r = { ...x }; delete r[campo]; return r; });
  const [busy, setBusy] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [erroEmail, setErroEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pinPara, setPinPara] = useState<string | null>(null);
  const [okEmail, setOkEmail] = useState(false);
  const matRef = useRef<HTMLInputElement>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const m = matricula.trim();
    const n = nome.trim().replace(/\s+/g, ' ');
    if (n.length < 2 || !/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .()-]*$/.test(n)) return falha('nome', 'Informe o seu nome completo, apenas com letras.');
    if (n.split(' ').filter((p) => p.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '').length >= 2).length < 2) return falha('nome', 'Informe nome e sobrenome, de preferência o nome completo.');
    if (!m) return falha('matricula', 'Informe a sua matrícula.');
    if (m.length < 3) return falha('matricula', 'A matrícula deve ter ao menos 3 caracteres.');
    if (!/^[A-Za-z0-9._\-/]+$/.test(m)) return falha('matricula', 'Use apenas letras, números e - . _ /');
    if (!cpfValido(cpf)) return falha('cpf', 'Informe um CPF válido');
    setErro('');
    setErrosCampo({});
    setBusy(true);
    try {
      await api('/perfil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula: m, nome: n, cpf: soDigitos(cpf) }) });
      await recarregar();
      if (config) {
        setBusy(false);
        setSalvo(true);
        setTimeout(() => setSalvo(false), 3500);
      }
    } catch (err) {
      const m = (err as Error).message;
      if (/cpf/i.test(m)) falha('cpf', m); else if (/matr[ií]cula/i.test(m)) falha('matricula', m); else { setErrosCampo({}); setErro(m); }
      setBusy(false);
    }
  }

  /** Pede o PIN: ele é enviado ao NOVO e-mail e a troca só vale depois de confirmado. */
  async function pedirPin(e: FormEvent) {
    e.preventDefault();
    const v = novoEmail.trim().toLowerCase();
    if (!v) return setErroEmail('Informe o novo e-mail.');
    if (!EMAIL_RE.test(v)) return setErroEmail('Digite um e-mail válido.');
    if (v === me.email.toLowerCase()) return setErroEmail('Este já é o seu e-mail atual.');
    setErroEmail('');
    setEnviando(true);
    try {
      const r = await api<{ email: string }>('/perfil/email/solicitar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: v }) });
      setPinPara(r.email);
    } catch (err) {
      setErroEmail((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function emailConfirmado() {
    setPinPara(null);
    setEditEmail(false);
    setNovoEmail('');
    setOkEmail(true);
    await recarregar();
    setTimeout(() => matRef.current?.focus(), 80); // segue direto para a matrícula
  }

const alterado = nome.trim().replace(/\s+/g, ' ') !== me.nome.replace(/ \(.*\)$/, '') || matricula.trim() !== (me.matricula ?? '') || soDigitos(cpf) !== soDigitos(me.cpf ?? '');
  const pronto = matricula.trim().length > 0 && cpfValido(cpf) && (!config || alterado);
  const PILULA = 'flex items-center gap-[0.8em] rounded-[0.9em] border border-[#e4d9c5] bg-white/90 px-[1em] shadow-[inset_0_1px_2px_rgba(60,40,10,.04)]';
  const campo = (Icon: typeof Mail, rotulo: string, valor: string, dica?: string, acao?: React.ReactNode, d = 0) => (
    <div className={`${PILULA} lift rise py-[0.6em]`} style={{ '--d': `${d}ms` } as React.CSSProperties}>
      <Icon size="1.3em" strokeWidth={1.7} className="shrink-0 text-[#b8902f]" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[0.68em] font-semibold uppercase tracking-[0.14em] text-[#8a7a62]">{rotulo}</p>
        <p className="truncate text-[1em] font-medium text-[#33240F]">{valor}</p>
        {dica && <p className="text-[0.72em] text-[#8a7a62]">{dica}</p>}
      </div>
      {acao}
    </div>
  );

  const Raiz = embutido ? 'div' : 'main';
  return (
    <Raiz className={embutido ? 'relative mx-auto flex w-full flex-col items-center pb-4 pt-1' : 'relative isolate flex min-h-dvh flex-col items-center overflow-hidden bg-[#fbf6ea] px-5 pb-8 pt-[clamp(1.8rem,6vw,3.2rem)]'}>
      {!embutido && <svg aria-hidden className="pointer-events-none absolute inset-0 -z-10 h-full w-full md:hidden" viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="p1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6bf62" /><stop offset=".6" stopColor="#f1d890" stopOpacity=".75" /><stop offset="1" stopColor="#f7e7b9" stopOpacity=".2" /></linearGradient>
          <linearGradient id="p2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#f8ecc6" stopOpacity=".1" /><stop offset=".6" stopColor="#dfb85a" stopOpacity=".7" /><stop offset="1" stopColor="#c8962b" stopOpacity=".85" /></linearGradient>
        </defs>
        <rect width="1024" height="1536" fill="#fbf6ea" />
        <path d="M0 0H360C240 70 100 170 0 360Z" fill="url(#p1)" />
        <path d="M0 360C120 200 260 100 390 0" fill="none" stroke="#e1bd63" strokeOpacity=".6" strokeWidth="2" />
        <path d="M1024 1010C930 1110 840 1230 760 1380" fill="none" stroke="#e1bd63" strokeOpacity=".45" strokeWidth="2" />
        <path d="M1024 1180C900 1290 780 1420 690 1536H1024Z" fill="url(#p2)" opacity=".55" />
        <path d="M1024 1330C940 1400 850 1470 800 1536H1024Z" fill="url(#p2)" />
      </svg>}
      {!embutido && <svg aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full md:block" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="d1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6bf62" /><stop offset=".6" stopColor="#f1d890" stopOpacity=".7" /><stop offset="1" stopColor="#f7e7b9" stopOpacity=".15" /></linearGradient>
          <linearGradient id="d2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#f8ecc6" stopOpacity=".1" /><stop offset=".6" stopColor="#dfb85a" stopOpacity=".7" /><stop offset="1" stopColor="#c8962b" stopOpacity=".85" /></linearGradient>
        </defs>
        <rect width="1600" height="900" fill="#fbf6ea" />
        <path d="M0 0H560C420 90 190 220 0 500Z" fill="url(#d1)" />
        <path d="M0 150C150 130 330 60 450 0H520C380 90 170 210 0 380Z" fill="#fff" opacity=".28" />
        <path d="M0 520C190 240 420 100 600 0" fill="none" stroke="#e1bd63" strokeOpacity=".6" strokeWidth="2" />
        <path d="M0 640C230 330 470 150 700 0" fill="none" stroke="#e1bd63" strokeOpacity=".35" strokeWidth="1.5" />
        <path d="M1600 560C1380 700 1160 820 1010 900H1600Z" fill="url(#d2)" opacity=".5" />
        <path d="M1600 700C1470 780 1330 850 1250 900H1600Z" fill="url(#d2)" />
        <path d="M1600 380C1440 520 1290 660 1190 900" fill="none" stroke="#e1bd63" strokeOpacity=".5" strokeWidth="2" />
        <path d="M1600 240C1500 360 1400 480 1320 620" fill="none" stroke="#e1bd63" strokeOpacity=".35" strokeWidth="1.5" />
      </svg>}

      {!embutido && <div className="rise"><Logo style={{ fontSize: 'clamp(17px,5.6vw,28px)' }} /></div>}

      <section className={`rise relative z-10 ${embutido ? '' : 'mt-[clamp(1.4rem,4vw,2.2rem)]'} w-full max-w-[460px] rounded-[2em] border border-white/80 p-[1.4em] pt-[1.7em] text-[16px] shadow-[0_2em_4.5em_-2.2em_rgba(120,80,20,.28),0_.2em_.7em_rgba(120,80,20,.06)] backdrop-blur-sm sm:max-w-[520px] sm:rounded-[2.2em] sm:p-[2.4em] sm:text-[17px]`} style={{ background: 'linear-gradient(180deg,rgba(255,254,250,.96),rgba(252,248,240,.93))', '--d': '80ms' } as React.CSSProperties}>
        {!config && <span aria-hidden className="grow-bar block h-[0.3em] w-[3.4em] rounded-full" style={{ background: 'linear-gradient(90deg,#d9a936,#b3801f)' }} />}
        <h1 className={`rise font-sans ${config ? '' : 'mt-[0.7em]'} text-[2.1em] font-bold leading-[1.05] tracking-[-0.02em] text-[#33240F]`} style={{ '--d': '120ms' } as React.CSSProperties}>{config ? 'Configurações' : 'Primeiro acesso'}</h1>
        <p className="rise mt-[0.35em] text-[0.95em] leading-snug text-[#5a5048]" style={{ '--d': '180ms' } as React.CSSProperties}>{config ? 'Edite os seus dados sempre que precisar.' : 'Complete seus dados para continuar.'}</p>

        <div className="pop mt-[1.2em] flex flex-col items-center" style={{ '--d': '200ms' } as React.CSSProperties}>
          <Avatar foto={me.foto_url} size={92} editavel onMudou={() => recarregar()} />
          <p className="mt-2 text-[0.78em] text-[#8a7a62]">Toque na foto para ver as opções</p>
        </div>

        <div className="mt-[1.1em] space-y-[0.7em]">
          <label htmlFor="nome" className={`${PILULA} lift rise cursor-text py-[0.6em] transition focus-within:border-[#c9a24a] focus-within:ring-4 focus-within:ring-[#c9a24a]/15 ${errosCampo.nome ? '!border-[#d9534f]' : ''}`} style={{ '--d': '240ms' } as React.CSSProperties}>
            <User size="1.3em" strokeWidth={1.7} className="shrink-0 text-[#b8902f]" aria-hidden />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[0.68em] font-semibold uppercase tracking-[0.14em] text-[#8a7a62]">Nome completo</p>
              <input id="nome" value={nome} onChange={(e) => { setNome(e.target.value); limpar('nome'); }} onBlur={() => setNome((x) => x.trim().replace(/\s+/g, ' '))} maxLength={100} autoComplete="name" className="w-full bg-transparent text-[1em] font-medium text-[#33240F] outline-none" />
            </div>
            <Pencil size="1.05em" className="shrink-0 text-[#b8902f]/70" aria-hidden />
          </label>
          <MsgErro texto={errosCampo.nome} onSumir={() => limpar('nome')} />
          {!editEmail ? (
            campo(Mail, 'E-mail', me.email, okEmail ? 'E-mail confirmado com sucesso.' : undefined,
              <button type="button" onClick={() => { setNovoEmail(me.email); setEditEmail(true); setOkEmail(false); }} aria-label="Alterar e-mail" className="flex shrink-0 items-center gap-1.5 border-l border-[#e4d9c5] pl-[0.9em] text-[0.85em] font-semibold text-[#a9771a] hover:underline"><Pencil size="1.1em" />Alterar</button>, 300)
          ) : (
            <form onSubmit={pedirPin} noValidate className="rounded-[0.9em] border border-[#c9a24a]/60 bg-white/90 p-[1em]">
              <label className="label" htmlFor="novo-email">Novo e-mail</label>
              <div className="mt-2 flex items-stretch gap-2">
                <div className="relative min-w-0 flex-1">
                  <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/60" aria-hidden />
                  <input id="novo-email" type="email" autoFocus autoComplete="email" onFocus={(e) => e.target.select()} value={novoEmail} onChange={(e) => { setNovoEmail(e.target.value); setErroEmail(''); }} aria-invalid={!!erroEmail} placeholder="novo@email.com" className={`field !mt-0 ${erroEmail ? '!border-[#d9534f]' : ''}`} />
                </div>
                {novoEmail.trim().toLowerCase() !== me.email.toLowerCase() && novoEmail.trim() !== '' && (
                  <button type="submit" disabled={enviando} className="btn btn-gold !min-h-0 shrink-0 !px-5 !text-[0.88rem]">{enviando ? <Spinner size={18} /> : 'Salvar'}</button>
                )}
              </div>
              {erroEmail && <p role="alert" className="mt-1.5 text-[0.8rem] font-medium text-[#b3261e]">{erroEmail}</p>}
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[0.75rem] text-ink/55">Enviaremos um código de 4 números para o novo endereço.</p>
                <button type="button" onClick={() => { setEditEmail(false); setErroEmail(''); setNovoEmail(''); }} className="shrink-0 text-[0.78rem] font-semibold text-ink/60 underline underline-offset-2">Cancelar</button>
              </div>
            </form>
          )}
          {campo(MapPin, 'Cidade', me.cidade ?? 'Não identificada', undefined, undefined, 360)}
        </div>

        <form onSubmit={salvar} noValidate className="rise mt-[0.7em]" style={{ '--d': '420ms' } as React.CSSProperties}>
          <label htmlFor="matricula" className={`${PILULA} cursor-text py-[0.6em] transition focus-within:border-[#c9a24a] focus-within:ring-4 focus-within:ring-[#c9a24a]/15 ${errosCampo.matricula || (config && !matricula.trim()) ? '!border-[#d9534f] focus-within:!ring-[#d9534f]/20' : ''}`}>
            <GraduationCap size="1.3em" strokeWidth={1.7} className="shrink-0 text-[#b8902f]" aria-hidden />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[0.68em] font-semibold uppercase tracking-[0.14em] text-[#8a7a62]">Matrícula</p>
              <input id="matricula" ref={matRef} value={matricula} onChange={(e) => { setMatricula(e.target.value); limpar('matricula'); }} maxLength={30} autoComplete="off" aria-invalid={!!erro} className="w-full bg-transparent text-[1em] font-medium text-[#33240F] outline-none" />
            </div>
          </label>
          <MsgErro texto={errosCampo.matricula} onSumir={() => limpar('matricula')} />
          <label htmlFor="cpf" className={`${PILULA} mt-[0.7em] cursor-text py-[0.6em] transition focus-within:border-[#c9a24a] focus-within:ring-4 focus-within:ring-[#c9a24a]/15 ${errosCampo.cpf || cpfEstado === 'erro' ? '!border-[#d9534f] !bg-[#fff6f5]' : cpfEstado === 'ok' ? '!border-[#3aa56b]' : ''}`}>
            <IconeCpf size="1.3em" strokeWidth={1.7} className="shrink-0 text-[#b8902f]" aria-hidden />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[0.68em] font-semibold uppercase tracking-[0.14em] text-[#8a7a62]">CPF</p>
              <input id="cpf" inputMode="numeric" value={cpf} onChange={(e) => { setCpf(mascaraCpf(e.target.value)); limpar('cpf'); }} maxLength={14} autoComplete="off" placeholder="000.000.000-00" className="w-full bg-transparent text-[1em] font-medium text-[#33240F] outline-none placeholder:text-[#33240F]/30" />
            </div>
            {cpfEstado === 'ok' && <Check size="1.3em" className="shrink-0 text-[#22a35a]" aria-label="CPF válido" />}
            {cpfEstado === 'erro' && <CircleAlert size="1.3em" className="shrink-0 text-[#d9534f]" aria-label="CPF inválido" />}
          </label>
          <MsgErro texto={errosCampo.cpf ?? (cpfEstado === 'erro' ? 'Informe um CPF válido' : undefined)} chave={cpf} onSumir={() => limpar('cpf')} />
          <MsgErro texto={erro} onSumir={() => setErro('')} />
          {salvo && <p role="status" className="pop mt-2 flex items-center gap-1.5 rounded-xl bg-[#e7f6ee] px-3 py-2 text-[0.85em] font-medium text-[#17794a]"><Check size="1.1em" />Dados salvos com sucesso.</p>}
          {(!config || pronto || busy) && (
            <button type="submit" disabled={busy || !pronto} className="fade-in mt-[1.3em] flex h-[3.2em] w-full items-center justify-center gap-[0.6em] rounded-[0.85em] text-[1.05em] font-semibold text-white active:scale-[.985] transition-all duration-300 disabled:cursor-not-allowed" style={pronto || busy ? (config ? { background: 'linear-gradient(180deg,#3bb273 0%,#25995c 55%,#1b7a48 100%)', boxShadow: '0 0.55em 1.1em -0.5em rgba(27,122,72,.6)' } : { background: 'linear-gradient(180deg,#dcae3c 0%,#bf8a22 55%,#9e6f15 100%)', boxShadow: '0 0.55em 1.1em -0.5em rgba(150,100,10,.65)' }) : { background: '#d9d6d0', color: '#8d877d', boxShadow: 'none' }}>
            {busy ? <><Spinner />Aguarde...</> : config ? 'Salvar' : <>Continuar<ArrowRight size="1.2em" strokeWidth={2} /></>}
          </button>
          )}
        </form>
        {config && <AlterarSenha me={me} />}
        {config ? (embutido ? null : (
          <button type="button" onClick={onVoltar} className="mx-auto mt-[1em] flex items-center gap-1.5 text-[0.88em] font-medium text-[#4f453b] underline underline-offset-2"><ArrowLeft size="1.1em" />Voltar</button>
        )) : (
          <button type="button" onClick={sair} style={{ '--d': '520ms' } as React.CSSProperties} className="rise mx-auto mt-[1em] flex items-center gap-1.5 text-[0.88em] font-medium text-[#4f453b] underline underline-offset-2"><LogOut size="1.1em" />Sair</button>
        )}
      </section>
      {pinPara && (
        <PinModal
          email={pinPara}
          onFechar={() => setPinPara(null)}
          onReenviar={async () => { await api('/perfil/email/solicitar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pinPara }) }); }}
          onConfirmar={async (pin) => { await api('/perfil/email/confirmar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }); await emailConfirmado(); }}
        />
      )}
    </Raiz>
  );
}

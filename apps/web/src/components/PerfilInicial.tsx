'use client';
import { FormEvent, useRef, useState } from 'react';
import { GraduationCap, LogOut, Mail, MapPin, Pencil, User } from 'lucide-react';
import { api, Me } from '@/lib/api';
import Avatar from './Avatar';
import { Ribbons, Wordmark } from './Brand';
import PinModal from './PinModal';
import Spinner from './Spinner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/;

/** Primeiro acesso do aluno: mostra os dados do perfil (foto do Google, e-mail, cidade) e exige a matrícula antes de liberar o envio de mídias. */
export default function PerfilInicial({ me, sair, recarregar }: { me: Me; sair: () => void; recarregar: () => Promise<unknown> | void }) {
  const [matricula, setMatricula] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [erroEmail, setErroEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pinPara, setPinPara] = useState<string | null>(null);
  const [okEmail, setOkEmail] = useState(false);
  const matRef = useRef<HTMLInputElement>(null);
  const primeiro = me.nome.replace(/ \(.*\)$/, '').split(' ')[0];

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const m = matricula.trim();
    if (!m) return setErro('Informe a sua matrícula.');
    if (m.length < 3) return setErro('A matrícula deve ter ao menos 3 caracteres.');
    if (!/^[A-Za-z0-9._\-/]+$/.test(m)) return setErro('Use apenas letras, números e - . _ /');
    setErro('');
    setBusy(true);
    try {
      await api('/perfil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula: m }) });
      await recarregar();
    } catch (err) {
      setErro((err as Error).message);
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

  const campo = (Icon: typeof Mail, rotulo: string, valor: string, dica?: string, acao?: React.ReactNode) => (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-[#fcfbf8] px-4 py-3">
      <Icon size={18} className="shrink-0 text-gold-500" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink/50">{rotulo}</p>
        <p className="truncate text-[0.95rem] font-medium">{valor}</p>
        {dica && <p className="text-[0.7rem] text-ink/45">{dica}</p>}
      </div>
      {acao}
    </div>
  );

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-white sm:grid sm:place-items-center sm:bg-gradient-to-b sm:from-white sm:to-[#f7f3ea] sm:px-5 sm:py-10">
      <div className="hidden sm:block"><Ribbons /></div>
      <section className="relative z-10 mx-auto w-full max-w-[440px]">
        <div className="flex justify-center pt-8 sm:pt-0"><Wordmark stacked /></div>
        <div className="mt-6 px-5 pb-8 sm:mt-7 sm:rounded-[22px] sm:border sm:border-line sm:bg-white sm:p-8 sm:shadow-soft">
          <p className="eyebrow">Primeiro acesso</p>
          <h1 className="mt-2 text-[2rem] font-bold">Bem-vindo(a), <span className="italic text-gold-600">{primeiro}</span>!</h1>
          <p className="mt-1 text-[0.88rem] text-ink/65">Confira os seus dados e informe a matrícula para começar a enviar as fotos dos atendimentos.</p>

          <div className="mt-5 flex flex-col items-center">
            <Avatar foto={me.foto_url} size={96} editavel onMudou={() => recarregar()} />
            <p className="mt-2 text-[0.78rem] text-ink/55">Toque na foto para alterar</p>
          </div>

          <div className="mt-5 space-y-2.5">
            {campo(User, 'Nome', me.nome)}
            {!editEmail ? (
              campo(Mail, 'E-mail', me.email, okEmail ? 'E-mail confirmado com sucesso.' : undefined,
                <button type="button" onClick={() => { setNovoEmail(me.email); setEditEmail(true); setOkEmail(false); }} aria-label="Alterar e-mail" className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[0.78rem] font-semibold text-gold-600 hover:bg-sand"><Pencil size={14} />Alterar</button>)
            ) : (
              <form onSubmit={pedirPin} noValidate className="rounded-xl border border-gold-500/50 bg-[#fcfbf8] p-4">
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
            {campo(MapPin, 'Cidade', me.cidade ?? 'Não identificada', 'Definida pela localização do seu dispositivo')}
          </div>

          <form onSubmit={salvar} noValidate className="mt-5">
            <label className="label" htmlFor="matricula">Matrícula <span className="text-[#b3261e]">*</span></label>
            <div className="relative mt-2">
              <GraduationCap size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/60" aria-hidden />
              <input id="matricula" ref={matRef} value={matricula} onChange={(e) => { setMatricula(e.target.value); setErro(''); }} maxLength={30} autoComplete="off" aria-invalid={!!erro} placeholder="Ex.: IS-0258" className={`field !mt-0 ${erro ? '!border-[#d9534f]' : ''}`} />
            </div>
            {erro && <p role="alert" className="mt-1.5 text-[0.8rem] font-medium text-[#b3261e]">{erro}</p>}
            <button type="submit" disabled={busy} className="btn btn-gold mt-5 w-full !min-h-[52px] !text-[1.02rem]">
              {busy ? <><Spinner />Aguarde...</> : 'Continuar'}
            </button>
          </form>
          <button type="button" onClick={sair} className="mx-auto mt-4 flex items-center gap-1.5 text-[0.82rem] font-medium text-ink/60 underline underline-offset-2"><LogOut size={14} />Sair</button>
        </div>
      </section>
      {pinPara && (
        <PinModal
          email={pinPara}
          onFechar={() => setPinPara(null)}
          onReenviar={async () => { await api('/perfil/email/solicitar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pinPara }) }); }}
          onConfirmar={async (pin) => { await api('/perfil/email/confirmar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }); await emailConfirmado(); }}
        />
      )}
    </main>
  );
}

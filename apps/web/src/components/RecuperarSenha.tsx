'use client';
import { FormEvent, useState } from 'react';
import { ArrowLeft, CircleAlert, CircleCheck, Check, Eye, EyeOff, KeyRound, Lock, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import PinModal from './PinModal';
import Spinner from './Spinner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/;
const JSON_H = { 'Content-Type': 'application/json' };

/** Casca inline (dentro do cartão do login), com atalho para voltar. */
function Casca({ children, onFechar, rotulo }: { children: React.ReactNode; onFechar: () => void; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo}>
      {children}
    </div>
  );
}

/** Recuperação de acesso: e-mail, PIN de 4 números (copiar e colar) e definição da nova senha. */
export default function RecuperarSenha({ emailInicial, onFechar, onConcluido }: { emailInicial: string; onFechar: () => void; onConcluido: (email: string) => void }) {
  const [passo, setPasso] = useState<'email' | 'pin' | 'nova'>('email');
  const [email, setEmail] = useState(emailInicial);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [ver, setVer] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [aviso, setAviso] = useState('');

  async function pedir() {
    await api('/auth/senha/solicitar', { method: 'POST', headers: JSON_H, body: JSON.stringify({ email: email.trim() }) });
  }

  const v = email.trim();
  const emailOk = EMAIL_RE.test(v);
  const msgCampo = erro || (tocado && !v ? 'Informe o seu e-mail.' : tocado && !emailOk ? 'Digite um e-mail válido, como nome@dominio.com.' : '');

  async function enviarEmail(e: FormEvent) {
    e.preventDefault();
    setTocado(true);
    if (!v) return setErro('Informe o seu e-mail.');
    if (!emailOk) return setErro('Digite um e-mail válido, como nome@dominio.com.');
    setErro('');
    setBusy(true);
    try {
      await pedir();
      setAviso(`Código enviado para ${v}.`);
      setPasso('pin');
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const regras: [string, boolean][] = [
    ['Pelo menos 8 caracteres', senha.length >= 8],
    ['Letras e números', /[A-Za-z]/.test(senha) && /\d/.test(senha)],
    ['As duas senhas são iguais', senha.length > 0 && senha === conf],
  ];
  const valida = regras.every(([, ok]) => ok);

  async function alterar(e: FormEvent) {
    e.preventDefault();
    if (!valida) return setErro('Confira os requisitos da senha.');
    setErro('');
    setBusy(true);
    try {
      await api('/auth/senha/redefinir', { method: 'POST', headers: JSON_H, body: JSON.stringify({ email: email.trim(), token, senha }) });
      onConcluido(email.trim());
    } catch (err) {
      setErro((err as Error).message);
      setBusy(false);
    }
  }

  const pinModal =
    passo === 'pin' ? (
      <PinModal
        email={email.trim()}
        titulo={<>Digite o <span className="text-gold-600">código</span></>}
        aviso={aviso}
        onFechar={onFechar}
        onReenviar={pedir}
        onConfirmar={async (pin) => {
          const r = await api<{ token: string }>('/auth/senha/confirmar', { method: 'POST', headers: JSON_H, body: JSON.stringify({ email: email.trim(), pin }) });
          setToken(r.token);
          setPasso('nova');
        }}
      />
    ) : null;

  if (passo === 'nova')
    return (
      <Casca onFechar={onFechar} rotulo="Definir nova senha">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><KeyRound size={26} /></span>
        <h2 className="mt-4 text-center text-[1.9rem] font-bold">Crie a sua <span className="text-gold-600">nova senha</span></h2>
        <p className="mt-2 text-center text-[0.88rem] text-ink/65">Código confirmado. Defina uma senha segura para voltar a acessar o sistema.</p>
        <form onSubmit={alterar} noValidate className="mt-6">
          <div className="relative">
            <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/60" aria-hidden />
            <input type={ver ? 'text' : 'password'} autoComplete="new-password" aria-label="Nova senha" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(''); }} placeholder="Nova senha" className="field pr-12" />
            <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senhas' : 'Mostrar senhas'} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-ink/70">{ver ? <EyeOff size={19} /> : <Eye size={19} />}</button>
          </div>
          <div className="relative mt-3">
            <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/60" aria-hidden />
            <input type={ver ? 'text' : 'password'} autoComplete="new-password" aria-label="Confirmar nova senha" value={conf} onChange={(e) => { setConf(e.target.value); setErro(''); }} placeholder="Confirmar nova senha" className="field" />
          </div>
          <ul className="mt-4 space-y-1.5" aria-label="Requisitos da senha">
            {regras.map(([t, ok]) => (
              <li key={t} className={`flex items-center gap-2 text-[0.82rem] transition ${ok ? 'font-medium text-[#17794a]' : 'text-ink/55'}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? 'bg-[#e7f6ee]' : 'bg-sand'}`}>{ok && <Check size={13} />}</span>{t}
              </li>
            ))}
          </ul>
          {erro && <p role="alert" className="mt-3 rounded-xl bg-sand px-4 py-3 text-sm font-medium text-gold-700">{erro}</p>}
          <button type="submit" disabled={busy || !valida} className="btn btn-gold mt-5 w-full !min-h-[52px] !text-[1.02rem]">{busy ? <><Spinner />Aguarde...</> : 'Alterar senha'}</button>
        </form>
      </Casca>
    );

  return (
    <>
    <Casca onFechar={onFechar} rotulo="Recuperar acesso">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f6efe0] text-gold-600"><Mail size={26} /></span>
      <h2 className="mt-4 text-center text-[1.9rem] font-bold">Recuperar <span className="text-gold-600">acesso</span></h2>
      <p className="mt-2 text-center text-[0.88rem] text-ink/65">Informe o e-mail da sua conta. Enviaremos um código de 4 números para você criar uma nova senha.</p>
      <form onSubmit={enviarEmail} noValidate className="mt-6">
        <div className="relative">
          <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/60" aria-hidden />
          <input type="email" autoComplete="email" inputMode="email" aria-label="E-mail" aria-invalid={!!msgCampo} aria-describedby="rec-msg" value={email} onChange={(e) => { setEmail(e.target.value); setErro(''); }} onBlur={() => setTocado(true)} placeholder="Seu e-mail" className={`field pr-11 ${msgCampo ? '!border-[#d9534f]' : emailOk ? '!border-[#3aa56b]' : ''}`} />
          {emailOk && !msgCampo && <CircleCheck size={19} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#22a35a]" aria-hidden />}
        </div>
        <div id="rec-msg" aria-live="polite">
          {msgCampo ? (
            <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-[#fdf0ee] px-3 py-2.5 text-[0.82rem] font-medium leading-snug text-[#b3261e]"><CircleAlert size={16} className="mt-0.5 shrink-0" />{msgCampo}</p>
          ) : (
            <p className="mt-2 text-[0.78rem] text-ink/50">Use o e-mail cadastrado no Instituto.</p>
          )}
        </div>
        <button type="submit" disabled={busy} className="btn btn-gold mt-5 w-full !min-h-[52px] !text-[1.02rem]">{busy ? <><Spinner />Aguarde...</> : 'Enviar código'}</button>
      </form>
    </Casca>
    {pinModal}
    </>
  );
}

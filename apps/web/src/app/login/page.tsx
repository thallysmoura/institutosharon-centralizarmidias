'use client';
import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Camera, Eye, EyeOff, Layers, Lock, Mail, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Ribbons, Wordmark } from '@/components/Brand';
import { entrarComGoogle } from '@/lib/firebase';
import { msgLocalizacao, pedirLocalizacao } from '@/lib/geo';
import Spinner from '@/components/Spinner';

const destaques: [typeof Camera, string, string][] = [
  [Camera, 'Envio direto do celular', 'Fotografe ou selecione imagens e envie em segundos.'],
  [ShieldCheck, 'Acesso restrito e privado', 'Somente alunos e administração autorizados visualizam as fotos.'],
  [Layers, 'Tudo centralizado', 'Todos os atendimentos organizados por paciente, aluno e cidade.'],
];

const msgGoogle = (code: string) =>
  ({
    'auth/configuration-not-found': 'O login com Google ainda não foi ativado no Firebase. Avise a administração do sistema.',
    'auth/operation-not-allowed': 'O login com Google ainda não foi ativado no Firebase. Avise a administração do sistema.',
    'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase. Avise a administração do sistema.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere os pop-ups e tente novamente.',
    'auth/network-request-failed': 'Sem conexão com a internet. Tente novamente.',
  } as Record<string, string>)[code] ?? `Não foi possível entrar com o Google (${code}). Tente novamente.`;

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState(false);
  const [loading, setLoading] = useState(false);
  const [via, setVia] = useState<'senha' | 'google'>('senha');
  const [fase, setFase] = useState<'login' | 'local'>('login');
  const [errs, setErrs] = useState<{ email?: string; senha?: string }>({});

  function validar() {
    const e: { email?: string; senha?: string } = {};
    if (!email.trim()) e.email = 'Informe o e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Digite um e-mail válido.';
    if (!senha) e.senha = 'Informe a senha.';
    else if (senha.length < 4) e.senha = 'A senha deve ter ao menos 4 caracteres.';
    setErrs(e);
    return !Object.keys(e).length;
  }

  /** Sessão aberta: a cidade é definida pelo servidor a partir da localização enviada no login. */
  function concluir(role: 'ADMIN' | 'ALUNO') {
    router.replace(role === 'ADMIN' ? '/admin' : '/aluno');
  }

  /** Pré-requisito do login: a localização precisa estar permitida. Sem ela, nenhuma sessão é criada. */
  async function exigirLocalizacao(): Promise<[number, number] | null> {
    setFase('local');
    try {
      return await pedirLocalizacao();
    } catch (e) {
      setErro(msgLocalizacao(e));
      setLoading(false);
      return null;
    }
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!validar()) return;
    setVia('senha');
    setLoading(true);
    const pos = await exigirLocalizacao();
    if (!pos) return;
    setFase('login');
    try {
      const { role } = await api<{ role: 'ADMIN' | 'ALUNO' }>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), senha, lat: pos[0], lng: pos[1] }),
      });
      concluir(role);
    } catch (err) {
      setErro((err as Error).message);
      setLoading(false);
    }
  }

  async function google() {
    setErro('');
    setErrs({});
    setVia('google');
    setFase('login');
    setLoading(true);
    try {
      const idToken = await entrarComGoogle(); // o popup precisa abrir direto do clique
      const pos = await exigirLocalizacao();
      if (!pos) return;
      setFase('login');
      const { role } = await api<{ role: 'ADMIN' | 'ALUNO' }>('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, lat: pos[0], lng: pos[1] }),
      });
      concluir(role);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setErro(code?.startsWith('auth/') ? msgGoogle(code) : (err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca — só em telas largas */}
      <aside className="relative isolate hidden overflow-hidden bg-side text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <Image src="/img/banner-experiencias.webp" alt="" fill priority sizes="55vw" quality={80} className="-z-20 object-cover object-[70%_40%] opacity-60" />
        <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-side via-side/85 to-side/60" />
        <Image src="/img/emblem.png" alt="" width={958} height={1624} aria-hidden className="floaty pointer-events-none absolute -right-10 top-[11%] -z-10 h-[78%] w-auto opacity-[0.09]" />
        <div className="rise"><Wordmark light /></div>
        <div className="max-w-[480px]">
          <p className="rise text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-gold-300" style={{ '--d': '120ms' } as React.CSSProperties}>Sistema de Centralização</p>
          <h2 className="rise mt-3 text-[2.6rem] font-bold leading-[1.1]" style={{ '--d': '220ms' } as React.CSSProperties}>
            Fotos clínicas, <span className="gold-text">organizadas</span> e seguras.
          </h2>
          <ul className="mt-9 space-y-5">
            {destaques.map(([Icon, t, d], i) => (
              <li key={t} className="rise flex items-start gap-4" style={{ '--d': `${380 + i * 120}ms` } as React.CSSProperties}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold-500/40 bg-white/5 text-gold-300"><Icon size={20} strokeWidth={1.6} /></span>
                <div className="leading-snug"><p className="font-semibold">{t}</p><p className="text-[0.88rem] text-white/65">{d}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[0.78rem] text-white/50">Instituto Sharon · Educação e Saúde</p>
      </aside>

      {/* Formulário */}
      <section className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-white to-[#f7f3ea]">
        <Ribbons />
        <span aria-hidden className="floaty pointer-events-none absolute -left-16 top-1/3 -z-10 h-56 w-56 rounded-full bg-gold-300/25 blur-3xl" />
        <span aria-hidden className="floaty pointer-events-none absolute -right-10 top-10 -z-10 h-44 w-44 rounded-full bg-gold-500/15 blur-3xl [animation-delay:-4s]" />

        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-[380px] lg:rounded-[28px] lg:border lg:border-line lg:bg-white/80 lg:p-10 lg:shadow-soft lg:backdrop-blur-sm">
            <div className="rise lg:hidden"><Wordmark stacked /></div>
            <div className="rise hidden lg:block" style={{ '--d': '100ms' } as React.CSSProperties}>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-gold-600">Bem-vindo(a)</p>
            </div>
            <h1 className="rise mt-9 text-center text-[1.7rem] font-bold lg:mt-2 lg:text-left lg:text-[2.3rem]" style={{ '--d': '120ms' } as React.CSSProperties}>Acesse o sistema</h1>
            <p className="rise mt-1 hidden text-sm text-ink/60 lg:block" style={{ '--d': '180ms' } as React.CSSProperties}>Entre com o e-mail e a senha cadastrados pelo Instituto.</p>

            <form onSubmit={entrar} noValidate className="rise mt-5" style={{ '--d': '240ms' } as React.CSSProperties}>
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/60" aria-hidden />
                <input type="email" autoComplete="email" aria-label="E-mail" aria-invalid={!!errs.email} value={email} onChange={(e) => { setEmail(e.target.value); setErrs((v) => ({ ...v, email: undefined })); }} placeholder="E-mail" className={`field ${errs.email ? '!border-[#d9534f]' : ''}`} />
              </div>
              {errs.email && <p role="alert" className="mt-1.5 text-[0.78rem] font-medium text-[#b3261e]">{errs.email}</p>}
              <div className="relative mt-3">
                <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/60" aria-hidden />
                <input type={ver ? 'text' : 'password'} autoComplete="current-password" aria-label="Senha" aria-invalid={!!errs.senha} value={senha} onChange={(e) => { setSenha(e.target.value); setErrs((v) => ({ ...v, senha: undefined })); }} placeholder="Senha" className={`field pr-12 ${errs.senha ? '!border-[#d9534f]' : ''}`} />
                <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-ink/70">
                  {ver ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {errs.senha && <p role="alert" className="mt-1.5 text-[0.78rem] font-medium text-[#b3261e]">{errs.senha}</p>}
              {erro && <p role="alert" className="mt-3 rounded-xl bg-sand px-4 py-3 text-sm font-medium text-gold-700">{erro}</p>}
              <button type="submit" disabled={loading} className="btn btn-gold mt-5 w-full !min-h-[52px] !text-[1.05rem]">
                {loading && via === 'senha' ? <><Spinner />{fase === 'local' ? 'Aguarde...' : 'Entrando…'}</> : 'Entrar'}
              </button>
            </form>
            <div className="rise mt-4 flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.2em] text-ink/40" style={{ '--d': '280ms' } as React.CSSProperties}>
              <span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" />
            </div>
            <button type="button" onClick={google} disabled={loading} className="rise btn btn-line mt-4 w-full !min-h-[52px] !gap-3" style={{ '--d': '300ms' } as React.CSSProperties}>
              <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
                <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              {loading && via === 'google' ? <><Spinner />{fase === 'local' ? 'Aguarde...' : 'Entrando…'}</> : 'Entrar com Google'}
            </button>
            <button type="button" onClick={() => setAviso(true)} className="rise mx-auto mt-5 block text-sm font-medium underline underline-offset-2 lg:mx-0" style={{ '--d': '320ms' } as React.CSSProperties}>Esqueceu sua senha?</button>
            {aviso && <p role="status" className="mt-3 text-center text-xs text-ink/60 lg:text-left">Procure a administração do Instituto para redefinir sua senha.</p>}
          </div>
        </div>

        <footer className="relative z-10 px-6 pb-5 pt-2 text-center text-[0.75rem] text-ink/55">
          © {new Date().getFullYear()} Instituto Sharon. Todos os direitos reservados.
        </footer>
      </section>
    </main>
  );
}

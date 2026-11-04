'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Layers, Lock, Mail, CircleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Emblema, Logo } from '@/components/Brand';
import { ehToque } from '@/lib/pwa';
import { entrarComGoogle, iniciarGoogleRedirecionamento, redirecionamentoPronto, tokenDoRedirecionamento } from '@/lib/firebase';
import { msgLocalizacao, pedirLocalizacao } from '@/lib/geo';
import Spinner from '@/components/Spinner';
import RecuperarSenha from '@/components/RecuperarSenha';
import Cadastro from '@/components/Cadastro';

const destaques: [string, string][] = [
  ['/img/ico-camera.png', 'Envio direto\ndo celular'],
  ['/img/ico-seguranca.png', 'Acesso restrito\ne privado'],
  ['/img/ico-centralizacao.png', 'Tudo\ncentralizado'],
];

/** Medida do desktop: o layout de referência tem 1825x862 e escala com a janela (variável --u). */
const u = (n: number) => `calc(var(--u) * ${n})`;
const OURO = 'linear-gradient(180deg,#dcae3c 0%,#bf8a22 55%,#9e6f15 100%)';
const CAMPO = 'h-[2.9em] w-full rounded-[0.85em] border border-[#e4d9c5] bg-white/90 pl-[3.1em] text-[1em] text-[#33240F] shadow-[inset_0_1px_2px_rgba(60,40,10,.05)] outline-none transition placeholder:text-[#6f665c] focus:border-[#c9a24a] focus:ring-4 focus:ring-[#c9a24a]/15';

const msgGoogle = (code: string) =>
  ({
    'auth/configuration-not-found': 'O login com Google ainda não foi ativado no Firebase. Avise a administração do sistema.',
    'auth/operation-not-allowed': 'O login com Google ainda não foi ativado no Firebase. Avise a administração do sistema.',
    'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase. Avise a administração do sistema.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere os pop-ups e tente novamente.',
    'auth/network-request-failed': 'Sem conexão com a internet. Tente novamente.',
  } as Record<string, string>)[code] ?? `Não foi possível entrar com o Google (${code}). Tente novamente.`;

/** O login com Google abre uma janela (pop-up). Não funciona no navegador interno de apps (WhatsApp, Instagram...) nem no app instalado do iPhone. */
function googleIndisponivel(): string | null {
  const ua = navigator.userAgent;
  const emApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|MicroMessenger|Messenger|Snapchat|TikTok|; wv\)/i.test(ua);
  if (emApp) return 'O login com Google não funciona dentro do navegador do WhatsApp ou de outros aplicativos. Abra este endereço no Chrome ou no Safari, ou entre com e-mail e senha.';
  return null;
}
const appInstalado = () => (navigator as Navigator & { standalone?: boolean }).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
const ehIphone = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const CHAVE_VINCULO = 'sharon_google_vinculo'; // app instalado: vínculo à espera do login feito no Google
type Vinculo = { codigo: string; segredo: string; lembrar: boolean; ate: number };
const lerVinculo = (): Vinculo | null => { try { const v = JSON.parse(localStorage.getItem(CHAVE_VINCULO) ?? 'null') as Vinculo | null; return v && v.ate > Date.now() ? v : null; } catch { return null; } };
const guardarVinculo = (v: Vinculo | null) => { try { if (v) localStorage.setItem(CHAVE_VINCULO, JSON.stringify(v)); else localStorage.removeItem(CHAVE_VINCULO); } catch { /* ignora */ } };
const esperar = (ms: number) => new Promise<void>((ok) => { const t = setTimeout(ok, ms); document.addEventListener('visibilitychange', () => { clearTimeout(t); ok(); }, { once: true }); });
const ehCelular = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const CHAVE_LEMBRAR = 'sharon_lembrar_email';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(false);
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const [recuperar, setRecuperar] = useState(false);
  const [cadastro, setCadastro] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);
  const [via, setVia] = useState<'senha' | 'google'>('senha');
  const [fase, setFase] = useState<'login' | 'local'>('login');
  const [errs, setErrs] = useState<{ email?: string; senha?: string }>({});

  function validar() {
    const e: { email?: string; senha?: string } = {};
    if (!email.trim()) e.email = 'Informe o e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/.test(email.trim())) e.email = 'Digite um e-mail válido, como nome@dominio.com.';
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

  // Dificulta copiar/arrastar as imagens e textos da marca (menu do botão direito, arrastar, selecionar e copiar). Campos de formulário continuam normais.
  useEffect(() => {
    const campo = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, [contenteditable="true"]');
    const bloqueia = (e: Event) => { if (!campo(e.target)) e.preventDefault(); };
    const eventos = ['contextmenu', 'dragstart', 'copy', 'cut', 'selectstart'];
    eventos.forEach((n) => document.addEventListener(n, bloqueia));
    return () => eventos.forEach((n) => document.removeEventListener(n, bloqueia));
  }, []);

  useEffect(() => {
    let e: string | null = null;
    try {
      e = localStorage.getItem(CHAVE_LEMBRAR);
      if (e) { setEmail(e); setLembrar(true); }
    } catch { /* armazenamento indisponível */ }
    const t = ehToque() ? 0 : setTimeout(() => document.querySelector<HTMLInputElement>(e ? 'input[type=password]' : 'input[type=email]')?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  function guardarLembrete() {
    try { if (lembrar) localStorage.setItem(CHAVE_LEMBRAR, email.trim()); else localStorage.removeItem(CHAVE_LEMBRAR); } catch { /* ignora */ }
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
        body: JSON.stringify({ email: email.trim(), senha, lat: pos[0], lng: pos[1], lembrar }),
      });
      guardarLembrete();
      concluir(role);
    } catch (err) {
      setErro((err as Error).message);
      setLoading(false);
    }
  }

  /** Atalho de desenvolvimento (só com NEXT_PUBLIC_DEV_LOGIN=1 e DEV_LOGIN=1 na API, apenas local). */
  async function entrarDev(perfil: 'ADMIN' | 'ALUNO') {
    setErro('');
    setLoading(true);
    try {
      const { role } = await api<{ role: 'ADMIN' | 'ALUNO' }>('/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil }) });
      concluir(role);
    } catch (err) {
      setErro((err as Error).message);
      setLoading(false);
    }
  }

  /** Depois de ter o ID token do Google (pela janela ou pelo redirecionamento): localização, sessão e entrada. */
  async function finalizarGoogle(idToken: string, lembrarEscolha: boolean) {
    const pos = await exigirLocalizacao();
    if (!pos) return;
    setFase('login');
    const { role } = await api<{ role: 'ADMIN' | 'ALUNO' }>('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, lat: pos[0], lng: pos[1], lembrar: lembrarEscolha }),
    });
    concluir(role);
  }

  function erroGoogle(err: unknown) {
    const code = (err as { code?: string }).code;
    // No celular a janela do Google muitas vezes fecha sem devolver o resultado: avisa em vez de voltar para o login sem explicação.
    if (code === 'auth/popup-closed-by-user' && ehCelular()) setErro('A janela do Google foi fechada antes de terminar. Tente de novo e escolha sua conta; se continuar, abra o endereço no Chrome ou no Safari, ou entre com e-mail e senha.');
    else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setErro(code?.startsWith('auth/') ? msgGoogle(code) : (err as Error).message);
    setLoading(false);
  }

  /** App instalado: espera o login do Google (feito no redirecionamento, às vezes em outra janela) e abre a sessão aqui. */
  async function aguardarVinculo(v: Vinculo) {
    setVia('google');
    setLoading(true);
    setSucesso('');
    for (;;) {
      if (Date.now() > v.ate) { guardarVinculo(null); throw new Error('O tempo para entrar com o Google acabou. Toque em Entrar com Google para tentar de novo.'); }
      if (!lerVinculo()) { setLoading(false); return; } // cancelado
      const r = await api<{ pronto: boolean }>('/auth/google/vinculo/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: v.codigo, segredo: v.segredo }) });
      if (r.pronto) break;
      await esperar(2000);
    }
    const pos = await exigirLocalizacao();
    if (!pos) { guardarVinculo(null); return; }
    setFase('login');
    const { role } = await api<{ role: 'ADMIN' | 'ALUNO' }>('/auth/google/vinculo/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: v.codigo, segredo: v.segredo, lat: pos[0], lng: pos[1], lembrar: v.lembrar }) });
    guardarVinculo(null);
    concluir(role);
  }

  // Volta do Google (app instalado): conclui o vínculo; se esta janela não for a do app, avisa para voltar a ele.
  useEffect(() => {
    const codigoUrl = new URLSearchParams(window.location.search).get('vinculo');
    const local = lerVinculo();
    if (!codigoUrl) { if (local) aguardarVinculo(local).catch((e) => erroGoogle(e)); return; }
    setVia('google');
    setLoading(true);
    tokenDoRedirecionamento()
      .then(async (t) => {
        window.history.replaceState(null, '', '/login');
        if (!t) { if (local) await aguardarVinculo(local); else setLoading(false); return; }
        await api('/auth/google/vinculo/concluir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: codigoUrl, idToken: t }) });
        if (local && local.codigo === codigoUrl) await aguardarVinculo(local);
        else { setLoading(false); setSucesso('Login com Google concluído. Feche esta janela (Concluído) e volte ao app para continuar.'); }
      })
      .catch((e) => erroGoogle(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function google() {
    setErro('');
    const bloqueio = googleIndisponivel();
    if (bloqueio) { setErro(bloqueio); return; }
    setErrs({});
    setVia('google');
    setFase('login');
    setLoading(true);
    try {
      // App instalado (tela cheia): a janela do Google não funciona; usa o redirecionamento, se o endereço já estiver liberado.
      if (appInstalado()) {
        if (await redirecionamentoPronto()) {
          const v = await api<{ codigo: string; segredo: string }>('/auth/google/vinculo', { method: 'POST' });
          guardarVinculo({ ...v, lembrar, ate: Date.now() + 10 * 60_000 });
          window.history.replaceState(null, '', `/login?vinculo=${v.codigo}`); // o Google devolve para este endereço
          await iniciarGoogleRedirecionamento();
          return;
        }
        if (ehIphone()) { setErro('No app instalado do iPhone, o login com Google ainda não está liberado. Abra o endereço no Safari ou entre com e-mail e senha.'); setLoading(false); return; }
      }
      const idToken = await entrarComGoogle(); // o popup precisa abrir direto do clique
      await finalizarGoogle(idToken, lembrar);
    } catch (err) {
      erroGoogle(err);
    }
  }

  const formulario = (
    <>
      <div className="px-[0.5em] min-[1100px]:px-[0.72em]">
                <h1 className="rise font-sans whitespace-nowrap text-[2.05em] font-medium leading-[1] min-[1100px]:text-[2.6em] tracking-[-0.02em] text-[#33240F]" style={{ '--d': '140ms' } as React.CSSProperties}>
          Fazer{' '}<span className="font-bold" style={{ background: 'linear-gradient(180deg,#d6a431,#a8761a)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>login</span>
        </h1>
                <p className="rise mt-[0.7em] text-[0.95em] leading-snug text-[#6b5a3c]" style={{ '--d': '200ms' } as React.CSSProperties}>Use sua conta para continuar</p>
              </div>

      {sucesso && <p role="status" className="rise mt-[1em] rounded-xl bg-[#e7f6ee] px-4 py-3 text-[0.9em] font-medium text-[#17794a]">{sucesso}</p>}
      <form onSubmit={entrar} noValidate className="rise mt-[1.07em]" style={{ '--d': '240ms' } as React.CSSProperties}>
        <div className="relative">
          <Mail size="1.3em" strokeWidth={1.7} className="pointer-events-none absolute left-[1.05em] top-1/2 -translate-y-1/2 text-[#33240F]" aria-hidden />
          <input type="email" autoFocus={!ehToque()} suppressHydrationWarning autoComplete="email" aria-label="E-mail" aria-invalid={!!errs.email} value={email} onChange={(e) => { setEmail(e.target.value); setErro(''); setErrs((v) => ({ ...v, email: undefined })); }} placeholder="E-mail" className={`${CAMPO} ${errs.email || erro ? '!border-[#d9534f] !bg-[#fff6f5]' : ''}`} />
        </div>
        {errs.email && <p role="alert" className="mt-1.5 text-[0.82em] font-medium text-[#b3261e]">{errs.email}</p>}
        <div className="relative mt-[0.7em]">
          <Lock size="1.3em" strokeWidth={1.7} className="pointer-events-none absolute left-[1.05em] top-1/2 -translate-y-1/2 text-[#33240F]" aria-hidden />
          <input type={ver ? 'text' : 'password'} autoComplete="current-password" aria-label="Senha" aria-invalid={!!errs.senha} value={senha} onChange={(e) => { setSenha(e.target.value); setErro(''); setErrs((v) => ({ ...v, senha: undefined })); }} placeholder="Senha" className={`${CAMPO} pr-[3em] ${errs.senha || erro ? '!border-[#d9534f] !bg-[#fff6f5]' : ''}`} />
          <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-[0.7em] top-1/2 grid h-[2.2em] w-[2.2em] -translate-y-1/2 place-items-center text-[#33240F]">
            {ver ? <EyeOff size="1.3em" strokeWidth={1.7} /> : <Eye size="1.3em" strokeWidth={1.7} />}
          </button>
        </div>
        {errs.senha && <p role="alert" className="mt-1.5 text-[0.82em] font-medium text-[#b3261e]">{errs.senha}</p>}
        <div className="mt-[0.95em] flex flex-wrap items-center justify-between gap-x-3 gap-y-[0.6em]">
          <label className="flex cursor-pointer select-none items-center gap-[0.6em] whitespace-nowrap text-[0.95em] text-[#33240F]">
            <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} className="check-gold !h-[1.25em] !w-[1.25em] !rounded-[0.3em]" />
            Mantenha-me conectado
          </label>
        </div>
        {erro && <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl border border-[#f0c5c0] bg-[#fdf0ee] px-4 py-3 text-[0.9em] font-medium text-[#b3261e]"><CircleAlert size="1.2em" className="shrink-0" aria-hidden />{erro}</p>}
        <button type="submit" disabled={loading} className="mt-[1.2em] flex h-[2.9em] w-full items-center justify-center gap-[0.6em] rounded-[0.85em] text-[1em] font-semibold text-white shadow-[0_0.55em_1.1em_-0.5em_rgba(150,100,10,.65)] transition hover:brightness-105 disabled:opacity-70" style={{ background: OURO }}>
          {loading && via === 'senha' ? <><Spinner />{fase === 'local' ? 'Aguarde...' : 'Entrando…'}</> : 'Entrar'}
        </button>
        {process.env.NEXT_PUBLIC_DEV_LOGIN === '1' && (
          <div className="mt-[0.7em] grid grid-cols-2 gap-[0.6em]">
            {(['ADMIN', 'ALUNO'] as const).map((p) => (
              <button key={p} type="button" disabled={loading} onClick={() => entrarDev(p)} className="h-[2.6em] rounded-[0.85em] border border-dashed border-[#c9a24a] bg-white text-[0.9em] font-semibold text-[#9a6b12] hover:bg-[#fbf5e6] disabled:opacity-70">{p === 'ADMIN' ? 'Administrador' : 'Aluno'}</button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => { setRecuperar(true); setSucesso(''); }} className="mx-auto mt-[0.95em] block whitespace-nowrap text-[0.95em] font-bold text-[#a9771a] hover:underline">Esqueceu a senha?</button>
      </form>
      <div className="rise my-[0.88em] flex items-center gap-[1em] text-[0.92em] text-[#4f453b]" style={{ '--d': '280ms' } as React.CSSProperties}>
        <span className="h-px flex-1 bg-[#e0d3ba]" />ou<span className="h-px flex-1 bg-[#e0d3ba]" />
      </div>
      <button type="button" onClick={google} disabled={loading} className="rise flex h-[2.9em] w-full items-center justify-center gap-[0.8em] rounded-[0.85em] border border-[#e4d9c5] bg-white text-[1em] font-medium text-[#33240F] shadow-[0_1px_2px_rgba(60,40,10,.04)] transition hover:border-[#c9a24a]/60 disabled:opacity-70" style={{ '--d': '300ms' } as React.CSSProperties}>
        <svg viewBox="0 0 48 48" className="h-[1.45em] w-[1.45em]" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        {loading && via === 'google' ? <><Spinner />{fase === 'local' ? 'Aguarde...' : 'Entrando…'}</> : 'Entrar com Google'}
      </button>
      <button type="button" onClick={() => { setCadastro(true); setSucesso(''); }} className="rise mt-[1.1em] h-[2.9em] w-full rounded-[0.85em] border border-[#c9a24a] bg-white text-[1em] font-semibold text-[#9a6b12] transition hover:bg-[#fbf5e6]" style={{ '--d': '340ms' } as React.CSSProperties}>Criar minha conta</button>
    </>
  );

  return (
    <main style={{ '--u': 'clamp(0.66px, min(calc(100vw / 1500), calc(100dvh / 880)), max(0.9px, calc(100vw / 2400)))' } as React.CSSProperties} className="protegido relative isolate flex min-h-dvh justify-center overflow-hidden bg-[#fbf6ea] min-[1100px]:bg-[#fbf3e3]">
      <div className="relative flex min-h-dvh w-full flex-col items-center px-8 pb-6 pt-[clamp(2.2rem,10vw,3.4rem)] min-[1100px]:grid min-[1100px]:h-dvh min-[1100px]:min-h-[34rem] min-[1100px]:grid-cols-[58%_42%] min-[1100px]:items-stretch min-[1100px]:p-0">
        {/* ====== Fundo desktop ====== */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 -z-20 hidden h-full w-full min-[1100px]:block" viewBox="0 0 1825 862" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="cr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffdf8" /><stop offset=".55" stopColor="#f9f0de" /><stop offset="1" stopColor="#f1e1c2" /></linearGradient>
            <linearGradient id="dk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#150d06" /><stop offset=".5" stopColor="#2e1c0b" /><stop offset="1" stopColor="#5d3a12" /></linearGradient>
            <radialGradient id="gl" cx="830" cy="360" r="560" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#d89a38" stopOpacity=".42" /><stop offset="1" stopColor="#d89a38" stopOpacity="0" /></radialGradient>
            <linearGradient id="sw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4dc94" stopOpacity=".05" /><stop offset=".5" stopColor="#dcb24f" stopOpacity=".42" /><stop offset="1" stopColor="#f2d58a" stopOpacity=".12" /></linearGradient>
          </defs>
          <rect width="1825" height="862" fill="url(#cr)" />
          <path d="M1825 500C1700 620 1560 760 1430 862H1825Z" fill="url(#sw)" />
          <path d="M1825 330C1750 430 1660 560 1560 700C1520 760 1480 815 1450 862H1580C1650 780 1740 650 1825 560Z" fill="url(#sw)" opacity=".7" />
          <path d="M1825 250C1740 350 1650 470 1580 580" fill="none" stroke="#dcb24f" strokeOpacity=".35" strokeWidth="1.5" />
          <path d="M1825 420C1730 540 1630 680 1540 862" fill="none" stroke="#dcb24f" strokeOpacity=".3" strokeWidth="1.2" />
          <path d="M1150 0C1190 60 1230 60 1300 0Z" fill="#e9c97b" opacity=".18" />
          <path d="M0 0H1112C1030 38 955 110 953 205C951 305 1030 385 1024 520C1018 640 900 745 742 862H0Z" fill="url(#dk)" />
          <path d="M0 0H1112C1030 38 955 110 953 205C951 305 1030 385 1024 520C1018 640 900 745 742 862H0Z" fill="url(#gl)" />
          <path d="M0 842C260 800 520 800 760 862" fill="none" stroke="#e0b04a" strokeOpacity=".28" strokeWidth="1.5" />
        </svg>
        <Emblema className="pointer-events-none absolute left-[32.5%] top-[12%] -z-10 hidden h-[77%] min-[1100px]:block" style={{ background: 'linear-gradient(160deg,#d29a3c,#8d5a1a)', opacity: 0.34 }} />
        <svg aria-hidden className="pointer-events-none absolute inset-0 -z-[5] hidden h-full w-full min-[1100px]:block" viewBox="0 0 1825 862" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="rb" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0" stopColor="#f6e2a0" /><stop offset=".35" stopColor="#d9a93e" /><stop offset=".7" stopColor="#b7801c" /><stop offset="1" stopColor="#ecc968" /></linearGradient>
            <linearGradient id="rb2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3c6" stopOpacity=".95" /><stop offset="1" stopColor="#d9a93e" stopOpacity=".5" /></linearGradient>
          </defs>
          <path d="M1112 0C1030 38 955 110 953 205C951 305 1030 385 1024 520C1018 640 900 745 742 862H812C945 770 1068 655 1076 520C1083 385 1005 315 1008 205C1010 125 1062 55 1156 0Z" fill="url(#rb)" />
          <path d="M1156 0C1062 55 1010 125 1008 205C1005 315 1083 385 1076 520C1068 655 945 770 812 862H830C960 778 1090 660 1098 520C1105 380 1030 310 1032 205C1034 130 1085 60 1180 0Z" fill="url(#rb2)" opacity=".55" />
          <path d="M1112 0C1030 38 955 110 953 205C951 305 1030 385 1024 520C1018 640 900 745 742 862" fill="none" stroke="#fff1bd" strokeOpacity=".8" strokeWidth="1.6" />
        </svg>

        {/* ====== Painel de marca (desktop) ====== */}
        <div className="relative z-10 hidden flex-col justify-between min-[1100px]:flex" style={{ padding: `${u(50)} 0 ${u(50)} ${u(120)}` }}>
          <Logo light style={{ fontSize: u(37.5), marginLeft: u(8) }} />
          <div>
            <div className="rise inline-flex items-center border border-[#c9a24a]/70 bg-black/20 text-white" style={{ height: u(49), padding: `0 ${u(26)}`, borderRadius: u(30), gap: u(14), fontSize: u(22), borderWidth: u(1.5) }}>
              <Layers style={{ width: u(26), height: u(26) }} className="text-[#e0a62c]" strokeWidth={1.6} />Sistema de Centralização
            </div>
            <h2 className="rise font-sans font-medium text-white" style={{ marginTop: u(22), fontSize: u(70.5), lineHeight: 0.9, letterSpacing: '-0.025em', '--d': '120ms' } as React.CSSProperties}>
              Fotos clínicas,<br /><span className="font-bold" style={{ background: 'linear-gradient(180deg,#f0be4a,#cf9420)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>organizadas</span> e<br />seguras.
            </h2>
            <span aria-hidden className="block bg-[#d4a23a]" style={{ marginTop: u(30), width: u(106), height: u(3) }} />
            <p className="rise text-white/85" style={{ marginTop: u(26), fontSize: u(21.5), lineHeight: 1.34, whiteSpace: 'nowrap', '--d': '260ms' } as React.CSSProperties}>
              Gerencie, organize e acompanhe os<br />atendimentos do Instituto Sharon em um só lugar.
            </p>
            <div className="flex" style={{ marginTop: u(36), gap: u(63) }}>
              {destaques.map(([src, t], i) => (
                <div key={t} className="pop flex flex-col items-center text-center text-white" style={{ width: u(120), '--d': `${800 + i * 380}ms` } as React.CSSProperties}>
                  <Image src={src} alt="" width={256} height={256} className="drop-shadow-[0_8px_18px_rgba(0,0,0,.45)]" style={{ width: u(78), height: u(78) }} />
                  <span className="whitespace-pre font-medium" style={{ marginTop: u(14), fontSize: u(18.5), lineHeight: 1.22 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <span aria-hidden />
        </div>

        {/* ====== Fundo mobile ====== */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 -z-20 h-full w-full min-[1100px]:hidden" viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="m1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6bf62" /><stop offset=".6" stopColor="#f1d890" stopOpacity=".75" /><stop offset="1" stopColor="#f7e7b9" stopOpacity=".2" /></linearGradient>
            <linearGradient id="m2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#f8ecc6" stopOpacity=".1" /><stop offset=".6" stopColor="#dfb85a" stopOpacity=".7" /><stop offset="1" stopColor="#c8962b" stopOpacity=".85" /></linearGradient>
          </defs>
          <rect width="1024" height="1536" fill="#fbf6ea" />
          <path d="M0 0H330C220 70 90 160 0 330Z" fill="url(#m1)" />
          <path d="M0 120C70 100 190 40 250 0H310C220 70 90 160 0 330Z" fill="#fff" opacity=".28" />
          <path d="M0 330C110 190 240 100 360 0" fill="none" stroke="#e1bd63" strokeOpacity=".6" strokeWidth="2" />
          <path d="M1024 1010C930 1110 840 1230 760 1380" fill="none" stroke="#e1bd63" strokeOpacity=".45" strokeWidth="2" />
          <path d="M1024 760C960 860 900 960 850 1060" fill="none" stroke="#e1bd63" strokeOpacity=".35" strokeWidth="2" />
          <path d="M1024 1180C900 1290 780 1420 690 1536H1024Z" fill="url(#m2)" opacity=".55" />
          <path d="M1024 1330C940 1400 850 1470 800 1536H1024Z" fill="url(#m2)" />
        </svg>

        <div className="flex w-full flex-col items-center min-[1100px]:max-h-dvh min-[1100px]:overflow-y-auto min-[1100px]:py-[calc(var(--u)*28)]">
        {/* Logo (mobile) */}
        <div className="rise relative z-10 min-[1100px]:hidden"><Logo style={{ fontSize: 'min(6.3vw, 30px)' }} /></div>

          <div className="flex w-full flex-col items-center min-[1100px]:my-auto min-[1100px]:w-[calc(var(--u)*523)] min-[1100px]:items-stretch">
        {/* ====== Cartão de login ====== */}
        <section
          className="relative z-10 mt-[clamp(1.4rem,5.5vw,2.2rem)] w-[calc(100%-0.5rem)] max-w-[600px] rounded-[1.6em] border border-white/80 p-[0.8em] pb-[1.6em] pt-[1.9em] text-[16px] shadow-[0_2em_4.5em_-2.2em_rgba(120,80,20,.28),0_.2em_.7em_rgba(120,80,20,.06)] backdrop-blur-sm min-[1100px]:mt-0 min-[1100px]:min-h-[calc(var(--u)*714)] min-[1100px]:w-full min-[1100px]:max-w-none min-[1100px]:rounded-[2.2em] min-[1100px]:px-[3.15em] min-[1100px]:pb-[2.2em] min-[1100px]:pt-[2.72em] min-[1100px]:text-[length:calc(var(--u)*18)]"
          style={{ background: 'linear-gradient(180deg,rgba(255,254,250,.96),rgba(252,248,240,.93))' }}
        >
          {cadastro ? (
            <Cadastro
              onFechar={() => setCadastro(false)}
              onConcluido={(r) => { setCadastro(false); if (r.logado) return concluir(r.role); setEmail(r.email); setSenha(''); setErrs({}); setErro(''); setSucesso('Cadastro concluído. Entre com o seu e-mail e senha.'); }}
            />
          ) : recuperar ? (
            <RecuperarSenha
              emailInicial={email}
              onFechar={() => setRecuperar(false)}
              onConcluido={(e) => { setRecuperar(false); setEmail(e); setSenha(''); setErrs({}); setErro(''); setSucesso('Senha alterada com sucesso. Entre com a nova senha.'); }}
            />
          ) : formulario}
        </section>
        <footer className="relative z-10 mt-8 pb-3 text-center text-[0.68rem] text-[#4f453b] min-[1100px]:mt-[calc(var(--u)*28)] min-[1100px]:text-center min-[1100px]:text-[length:calc(var(--u)*12)]">
          © {new Date().getFullYear()} Instituto Sharon. Todos os direitos reservados.
        </footer>
          </div>
        </div>
      </div>

    </main>
  );
}
